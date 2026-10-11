import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify, matchAccount, type ClassifyContext } from "./classify";
import { readForwardingConfirmation } from "./gmail";
import { htmlToText, readMessage } from "./message";
import type { TemplateParser } from "./parsers/types";

const fixture = (name: string) => readFileSync(join(process.cwd(), "fixtures/emails/_synthetic", name), "utf8");

// A parser for the synthetic test bank only. Real parsers live in parsers/ and are built from real samples.
const testBankParser: TemplateParser = {
  id: "testbank.card-alert",
  version: 1,
  institution: "testbank",
  matches: (m) => m.subject.includes("Card transaction alert"),
  parse: (m) => {
    const amount = /Amount\s+PHP\s+([\d,]+)\.(\d{2})/.exec(m.text);
    const last4 = /Card ending\s+(\d{4})/.exec(m.text)?.[1] ?? null;
    const merchant = /Merchant\s+(.+)/.exec(m.text)?.[1]?.trim() ?? null;
    if (!amount || !m.date) return null;
    return {
      amountCentavos: -(Number(amount[1].replace(/,/g, "")) * 100 + Number(amount[2])),
      occurredAt: m.date,
      merchant,
      last4,
      accountType: "credit",
    };
  },
};

const ctx: ClassifyContext = {
  institutions: [{ id: "inst-tb", slug: "testbank", name: "Test Bank", emailDomains: ["testbank.example"] }],
  accounts: [
    { id: "acct-credit", institutionId: "inst-tb", type: "credit", last4: "4417", archived: false },
    { id: "acct-savings", institutionId: "inst-tb", type: "savings", last4: "7712", archived: false },
  ],
  forwardingSources: ["someone.example@gmail.com"],
  parsers: [testBankParser],
};

describe("readMessage", () => {
  it("reads an auto-forwarded HTML email and who forwarded it", async () => {
    const msg = await readMessage(fixture("auto-forward.eml"));
    expect(msg.from).toBe("alerts@testbank.example");
    expect(msg.forwardedBy).toBe("someone.example@gmail.com");
    expect(msg.text).toContain("JOLLIBEE KATIPUNAN");
    expect(msg.authFailed).toBe(false);
  });

  it("unwraps a manual Gmail forward to the original sender and date", async () => {
    const msg = await readMessage(fixture("manual-forward.eml"));
    expect(msg.from).toBe("alerts@testbank.example");
    expect(msg.forwardedBy).toBe("someone.example@gmail.com");
    expect(msg.subject).toBe("Card transaction alert");
    expect(msg.text.startsWith("Card ending 4417")).toBe(true);
    expect(msg.date).not.toBeNull();
  });

  it("turns HTML into readable lines", () => {
    expect(htmlToText("<p>Amount</p><p>&#8369;1,500.00</p><style>x{}</style>")).toBe("Amount\n₱1,500.00");
  });
});

describe("Gmail forwarding confirmation", () => {
  it("extracts the code and the mailbox that asked", async () => {
    const msg = await readMessage(fixture("gmail-forwarding-confirmation.eml"));
    const expected = { code: "123456789", confirmUrl: "https://mail-settings.google.com/mail/vf-SYNTHETIC", requestedBy: "someone.example@gmail.com" };
    expect(readForwardingConfirmation(msg)).toEqual(expected);
    expect(classify(msg, ctx)).toEqual({ kind: "gmail_confirmation", ...expected });
  });

  it("reads today's link-only confirmation, offering the confirm link and never the cancel link", async () => {
    const msg = await readMessage(fixture("gmail-forwarding-confirmation-link.eml"));
    expect(readForwardingConfirmation(msg)).toEqual({
      code: null,
      confirmUrl: "https://mail-settings.google.com/mail/vf-%5BSYNTHETICverifyTOKEN%5D-SYNTHETICsuffix",
      requestedBy: "someone.example@gmail.com",
    });
  });

  it("ignores look-alikes that are not from Google", async () => {
    const raw = fixture("gmail-forwarding-confirmation.eml").replace("forwarding-noreply@google.com", "forwarding-noreply@g00gle.example");
    expect(readForwardingConfirmation(await readMessage(raw))).toBeNull();
  });
});

describe("classify", () => {
  it("creates a transaction on the matching account", async () => {
    const outcome = classify(await readMessage(fixture("auto-forward.eml")), ctx);
    expect(outcome).toMatchObject({
      kind: "transaction",
      parser: "testbank.card-alert",
      accountId: "acct-credit",
      transaction: { amountCentavos: -28900, merchant: "JOLLIBEE KATIPUNAN", last4: "4417" },
    });
  });

  it("treats manual and automatic forwards the same", async () => {
    const auto = classify(await readMessage(fixture("auto-forward.eml")), ctx);
    const manual = classify(await readMessage(fixture("manual-forward.eml")), ctx);
    expect(manual.kind).toBe("transaction");
    expect(auto.kind).toBe("transaction");
  });

  it("flags forwards from a mailbox the user hasn't added", async () => {
    const outcome = classify(await readMessage(fixture("auto-forward.eml")), { ...ctx, forwardingSources: [] });
    expect(outcome).toEqual({ kind: "flagged", note: "Forwarded from someone.example@gmail.com, which isn't one of your addresses." });
  });

  it("flags senders that are not on the bank allowlist, even with a bank-like name", async () => {
    const raw = fixture("auto-forward.eml").replace("alerts@testbank.example", "alerts@testbank-security.example");
    expect((classify(await readMessage(raw), ctx)).kind).toBe("flagged");
  });

  it("flags emails whose sender failed DKIM or SPF", async () => {
    const raw = fixture("auto-forward.eml").replace("dkim=pass", "dkim=fail");
    expect(classify(await readMessage(raw), ctx)).toMatchObject({ kind: "flagged" });
  });

  it("keeps known-bank emails with no parser yet, with a clear note", async () => {
    const outcome = classify(await readMessage(fixture("auto-forward.eml")), { ...ctx, parsers: [] });
    expect(outcome).toEqual({ kind: "failed", note: "No reader for this Test Bank email yet." });
  });

  it("asks for the account when none matches", async () => {
    const outcome = classify(await readMessage(fixture("auto-forward.eml")), { ...ctx, accounts: [] });
    expect(outcome).toMatchObject({ kind: "failed", note: "Add your Test Bank account ending in 4417 so this can be matched." });
  });

  it("rejects parser output that fails the shared schema", async () => {
    const broken: TemplateParser = { ...testBankParser, parse: () => ({ amountCentavos: 12.5, occurredAt: "yesterday", merchant: null, last4: null, accountType: null }) };
    const outcome = classify(await readMessage(fixture("auto-forward.eml")), { ...ctx, parsers: [broken] });
    expect(outcome).toMatchObject({ kind: "failed", note: "Couldn't read the amount or date in this email." });
  });
});

describe("matchAccount", () => {
  const inst = ctx.institutions[0];
  const tx = { amountCentavos: -100, occurredAt: "2026-10-11T00:00:00Z", merchant: null, last4: null, accountType: null };
  it("needs an unambiguous match", () => {
    expect(matchAccount(tx, inst, ctx.accounts)).toBeNull();
    expect(matchAccount({ ...tx, accountType: "savings" }, inst, ctx.accounts)).toBe("acct-savings");
    expect(matchAccount({ ...tx, last4: "4417" }, inst, ctx.accounts)).toBe("acct-credit");
  });
  it("ignores archived accounts", () => {
    const archived = ctx.accounts.map((a) => ({ ...a, archived: a.id === "acct-credit" }));
    expect(matchAccount({ ...tx, last4: "4417" }, inst, archived)).toBeNull();
  });
});
