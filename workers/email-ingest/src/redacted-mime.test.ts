import PostalMime from "postal-mime";
import { describe, expect, it } from "vitest";
import { withoutCardNumbers } from "./redacted-mime";

const html = "<p>Credit Card Number</p><p>4111111111111111</p><p>Bill Amount 556.00</p>";
const raw = [
  "From: GCash Bills Payment <no-reply@gcash.example>",
  "To: u_test000000@in.jadebonifacio.dev",
  "Subject: Your GBills Receipt",
  "Message-ID: <synthetic-pan-1@gcash.example>",
  "X-Forwarded-For: someone.example@gmail.com u_test000000@in.jadebonifacio.dev",
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from(html).toString("base64"),
  "",
].join("\r\n");

describe("withoutCardNumbers (email Worker)", () => {
  it("masks a card number hidden in a base64 body and keeps the headers the parser needs", async () => {
    const result = await withoutCardNumbers(raw);
    expect(result.redacted).toBe(true);
    expect(result.raw).not.toContain("4111111111111111");
    expect(result.raw).not.toContain(Buffer.from(html).toString("base64"));

    const mail = await PostalMime.parse(result.raw);
    expect(mail.html).toContain("************1111");
    expect(mail.html).toContain("Bill Amount 556.00");
    expect(mail.subject).toBe("Your GBills Receipt");
    expect(mail.messageId).toBe("<synthetic-pan-1@gcash.example>");
    expect(mail.headers.find((h) => h.key === "x-forwarded-for")?.value).toContain("someone.example@gmail.com");
  });

  it("leaves emails without card numbers exactly as received", async () => {
    const clean = raw.replace(Buffer.from(html).toString("base64"), Buffer.from("<p>Ref No. 4000000000001</p>").toString("base64"));
    expect(await withoutCardNumbers(clean)).toEqual({ raw: clean, redacted: false });
  });
});
