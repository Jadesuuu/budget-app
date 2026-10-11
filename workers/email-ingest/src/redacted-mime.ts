import PostalMime from "postal-mime";
import { containsCardNumber, redactCardNumbers } from "../../../shared/redact";

// Rebuilt copies drop the original body encoding, so these describe the new body instead.
const DROPPED_HEADERS = new Set(["content-type", "content-transfer-encoding", "mime-version", "content-length"]);

/**
 * Returns the raw email unchanged unless its decoded content contains a full card number. In that case it
 * returns a rebuilt copy (same headers, text and HTML bodies) with card numbers masked, so the full number
 * is never stored. Attachments are dropped from the rebuilt copy.
 */
export async function withoutCardNumbers(raw: string): Promise<{ raw: string; redacted: boolean }> {
  const mail = await PostalMime.parse(raw);
  const parts = [mail.subject ?? "", mail.text ?? "", mail.html ?? "", ...mail.headers.map((h) => h.value)];
  if (!parts.some(containsCardNumber)) return { raw, redacted: false };

  const boundary = `budget-${crypto.randomUUID()}`;
  const headerLines = mail.headerLines
    .filter((h) => !DROPPED_HEADERS.has(h.key))
    .map((h) => redactCardNumbers(h.line.replace(/\r?\n[ \t]+/g, " ")));

  const lines = [
    ...headerLines,
    "X-Budget-Redacted: card-numbers",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
  ];
  if (mail.text) {
    lines.push(`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", redactCardNumbers(mail.text));
  }
  if (mail.html) {
    lines.push(`--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", redactCardNumbers(mail.html));
  }
  lines.push(`--${boundary}--`, "");
  return { raw: lines.join("\r\n"), redacted: true };
}
