import PostalMime from "postal-mime";

/** The parts of an email the parsers care about, after unwrapping any forward. */
export type Message = {
  messageId: string | null;
  /** Who the email is really from: the bank, even when the user forwarded it by hand. */
  from: string;
  fromName: string;
  subject: string;
  /** ISO timestamp of the original email, if known. */
  date: string | null;
  text: string;
  html: string;
  /** Mailbox that forwarded it to Budget, if it was forwarded. */
  forwardedBy: string | null;
  /** Authentication-Results reported a DKIM or SPF failure for the sender. */
  authFailed: boolean;
};

const FORWARD_MARKER = /^-{5,}\s*Forwarded message\s*-{5,}\s*$/im;

export async function readMessage(raw: string): Promise<Message> {
  const mail = await PostalMime.parse(raw);
  const header = (name: string) => mail.headers.find((h) => h.key === name)?.value ?? null;
  const fromBox = mail.from && "address" in mail.from && mail.from.address ? mail.from : null;
  const text = (mail.text ?? (mail.html ? htmlToText(mail.html) : "")).replace(/\r\n/g, "\n");

  const base: Message = {
    messageId: mail.messageId ?? null,
    from: (fromBox?.address ?? "").toLowerCase(),
    fromName: fromBox?.name ?? "",
    subject: mail.subject ?? "",
    date: toIso(mail.date),
    text,
    html: mail.html ?? "",
    forwardedBy: autoForwarder(header("x-forwarded-for")),
    authFailed: /\b(dkim|spf)=fail\b/i.test(header("authentication-results") ?? ""),
  };

  // Gmail's manual "Forward": the email comes from the user, with the bank's email quoted inside.
  const manual = unwrapManualForward(text);
  if (manual) {
    return {
      ...base,
      forwardedBy: base.from,
      from: manual.from,
      fromName: manual.fromName,
      subject: manual.subject || base.subject,
      date: manual.date ?? base.date,
      text: manual.body,
      authFailed: false,
    };
  }
  return base;
}

/** Gmail auto-forwarding adds "X-Forwarded-For: <mailbox> <forward target>". */
function autoForwarder(value: string | null): string | null {
  const first = value?.trim().split(/[\s,]+/)[0];
  return first && first.includes("@") ? first.toLowerCase() : null;
}

export function unwrapManualForward(text: string): { from: string; fromName: string; subject: string; date: string | null; body: string } | null {
  const marker = FORWARD_MARKER.exec(text);
  if (!marker) return null;
  const after = text.slice(marker.index + marker[0].length).replace(/^\s*\n/, "");
  const [headerBlock, ...rest] = after.split(/\n\s*\n/);
  const fields = new Map<string, string>();
  for (const line of headerBlock.split("\n")) {
    const m = /^\s*(From|Date|Subject|To):\s*(.*)$/i.exec(line);
    if (m) fields.set(m[1].toLowerCase(), m[2].trim());
  }
  const fromField = fields.get("from");
  if (!fromField) return null;
  const address = (/<([^>]+)>/.exec(fromField)?.[1] ?? fromField).trim().toLowerCase();
  if (!address.includes("@")) return null;
  const name = fromField.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
  return {
    from: address,
    fromName: name,
    subject: fields.get("subject") ?? "",
    date: toIso(fields.get("date")?.replace(/\s+at\s+/i, " ")),
    body: rest.join("\n\n").trim(),
  };
}

function toIso(value: string | undefined | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Good enough for template matching: keeps line breaks at block elements, drops tags and styles. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8369;|&#x20b1;/gi, "₱")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function domainOf(address: string): string {
  return address.split("@")[1]?.toLowerCase() ?? "";
}
