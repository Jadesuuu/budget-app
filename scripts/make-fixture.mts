// Turns a real .eml into a redacted fixture for parser tests. Only the output is ever committed.
//
//   pnpm fixture:make <input.eml> <output.eml> [--replace "REAL=>FAKE"]...
//
// Always: masks card numbers, scrambles long digit runs (reference/account numbers), removes links,
// drops attachments, and replaces the recipient with a fixture alias. --replace handles names, emails
// and last-4 digits. Review the output by eye before committing.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import PostalMime from "postal-mime";
import { redactCardNumbers } from "../shared/redact.ts";

const args = process.argv.slice(2);
const [input, output] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--replace");
if (!input || !output) throw new Error("usage: make-fixture <input.eml> <output.eml> [--replace REAL=>FAKE]...");
const replacements = args
  .map((a, i) => (args[i - 1] === "--replace" ? a.split("=>") : null))
  .filter((pair): pair is string[] => Array.isArray(pair) && pair.length === 2);

function redact(text: string): string {
  let out = redactCardNumbers(text);
  for (const [real, fake] of replacements) out = out.split(real).join(fake);
  out = out.replace(/https?:\/\/[^\s"'<>)]+/g, "https://example.com/redacted");
  // Reference, trace, invoice and account numbers: keep the length and shape, lose the value.
  out = out.replace(/\d{7,}/g, (run) => run[0] + "0".repeat(run.length - 2) + "1");
  return out;
}

const mail = await PostalMime.parse(readFileSync(input));
const fromBox = mail.from && "address" in mail.from ? mail.from : null;
const boundary = "fixture-boundary";
const lines = [
  `From: ${fromBox?.name ? `${redact(fromBox.name)} ` : ""}<${fromBox?.address}>`,
  "To: u_test000000@in.jadebonifacio.dev",
  `Subject: ${redact(mail.subject ?? "")}`,
  `Date: ${mail.date ? new Date(mail.date).toUTCString().replace("GMT", "+0000") : ""}`,
  `Message-ID: <fixture-${output.replace(/[^a-z0-9]+/gi, "-")}@budget.test>`,
  "MIME-Version: 1.0",
  `Content-Type: multipart/alternative; boundary="${boundary}"`,
  "",
];
if (mail.text) lines.push(`--${boundary}`, "Content-Type: text/plain; charset=utf-8", "", redact(mail.text));
if (mail.html) {
  const html = mail.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<img[^>]*>/gi, "");
  lines.push(`--${boundary}`, "Content-Type: text/html; charset=utf-8", "", redact(html));
}
lines.push(`--${boundary}--`, "");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, lines.join("\r\n"));
console.log(`${output} (${mail.attachments.length} attachment(s) dropped)`);
