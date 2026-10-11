import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify, type ClassifyContext } from "../classify";
import { readMessage } from "../message";
import { TEMPLATE_PARSERS } from "./index";

// Every case here is a redacted copy of a real email (fixtures/emails/<institution>/).
const ctx: ClassifyContext = {
  institutions: [
    { id: "i-gcash", slug: "gcash", name: "GCash", emailDomains: ["gcash.com"] },
    { id: "i-bpi", slug: "bpi", name: "BPI", emailDomains: ["bpi.com.ph"] },
    { id: "i-atome", slug: "atome", name: "Atome", emailDomains: ["atome.ph"] },
    { id: "i-ew", slug: "eastwest", name: "EastWest", emailDomains: ["eastwestbanker.com"] },
    { id: "i-tiktok", slug: "tiktok-shop", name: "TikTok Shop", emailDomains: [] },
  ],
  accounts: [
    { id: "acct-gcash", institutionId: "i-gcash", type: "ewallet", last4: null, archived: false },
    { id: "acct-bpi-savings", institutionId: "i-bpi", type: "savings", last4: "5678", archived: false },
    { id: "acct-bpi-credit", institutionId: "i-bpi", type: "credit", last4: "9999", archived: false },
    { id: "acct-atome", institutionId: "i-atome", type: "bnpl", last4: "4321", archived: false },
    { id: "acct-ew", institutionId: "i-ew", type: "credit", last4: "1234", archived: false },
    { id: "acct-tiktok", institutionId: "i-tiktok", type: "bnpl", last4: null, archived: false },
  ],
  forwardingSources: ["someone.example@gmail.com"],
  parsers: TEMPLATE_PARSERS,
};

const load = (path: string) => readMessage(readFileSync(join(process.cwd(), "fixtures/emails", path), "utf8"));

describe("bank email parsers (real, redacted samples)", () => {
  it.each([
    ["gcash/bank-transfer.eml", "acct-gcash", { amountCentavos: -100000, feeCentavos: 1000, merchant: "Transfer to BPI / VYBE by BPI ••5678", occurredAt: "2026-10-06T22:56:31+08:00" }],
    ["gcash/gbills-eastwest.eml", "acct-gcash", { amountCentavos: -55600, feeCentavos: 1000, merchant: "EastWest Bank", occurredAt: "2026-08-20T12:11:15.000Z" }],
    ["gcash/billspay-smart.eml", "acct-gcash", { amountCentavos: -110000, feeCentavos: 700, merchant: "Smart Communications" }],
    ["bpi/instapay-incoming-from-bdo.eml", "acct-bpi-savings", { amountCentavos: 1500000, merchant: "InstaPay from BDO Unibank", last4: "5678", occurredAt: "2026-02-15T15:27:05+08:00" }],
    ["bpi/instapay-incoming-from-gcash.eml", "acct-bpi-savings", { amountCentavos: 311000, merchant: "InstaPay from G-Xchange", occurredAt: "2025-12-17T04:05:59+08:00" }],
    ["atome/card-transaction-shopee.eml", "acct-atome", { amountCentavos: -9900, merchant: "SHOPEE PH MANDALUYONG PHL", last4: "4321" }],
    ["atome/card-transaction-steam.eml", "acct-atome", { amountCentavos: -21135, merchant: "STEAMGAMES.COM 4000001 BELLEVUE USA", last4: "4321" }],
    ["atome/card-transaction-qrph.eml", "acct-atome", { amountCentavos: -28400, merchant: "UNCLE JOHNS MONTOJO", last4: null }],
    ["atome/refund.eml", "acct-atome", { amountCentavos: 1388500, merchant: "Atome refund" }],
  ])("%s becomes a transaction", async (file, accountId, expected) => {
    const outcome = classify(await load(file), ctx);
    expect(outcome).toMatchObject({ kind: "transaction", accountId, transaction: expected });
  });

  it.each([
    ["eastwest/esoa-sep.eml", "acct-ew", { statementDate: "2026-09-27", dueDate: "2026-10-21", totalCentavos: 2603458, minimumCentavos: 91121 }],
    ["eastwest/esoa-jul.eml", "acct-ew", { statementDate: "2026-07-27", dueDate: "2026-08-20", totalCentavos: 1586994, minimumCentavos: 55545 }],
    ["atome/bill-statement.eml", "acct-atome", { statementDate: "2026-09-17", dueDate: "2026-09-27", totalCentavos: 649224 }],
    ["atome/due-reminder.eml", "acct-atome", { statementDate: null, dueDate: "2026-08-27", totalCentavos: 998745 }],
    ["atome/tiktok-paylater-reminder.eml", "acct-tiktok", { institutionSlug: "tiktok-shop", dueDate: "2026-06-15", totalCentavos: 404418 }],
  ])("%s becomes a statement", async (file, accountId, expected) => {
    expect(classify(await load(file), ctx)).toMatchObject({ kind: "statement", accountId, statement: expected });
  });

  it("files TikTok PayLater bills under TikTok PayLater, never the Atome Card", async () => {
    const noTikTok = { ...ctx, accounts: ctx.accounts.filter((a) => a.id !== "acct-tiktok") };
    expect(classify(await load("atome/tiktok-paylater-reminder.eml"), noTikTok)).toMatchObject({
      kind: "failed",
      note: "Add your TikTok Shop account so its statements can be recorded.",
    });
  });

  it("treats the collections advisory as a reminder only", async () => {
    expect((await classify(await load("eastwest/minimum-payment-advisory.eml"), ctx)).kind).toBe("info");
  });

  it("matches the BPI deposit account even though the email doesn't say savings or debit", async () => {
    const debitOnly = { ...ctx, accounts: ctx.accounts.map((a) => (a.id === "acct-bpi-savings" ? { ...a, type: "debit" } : a)) };
    expect(classify(await load("bpi/instapay-incoming-from-bdo.eml"), debitOnly)).toMatchObject({ accountId: "acct-bpi-savings" });
  });

  it("never sees a full card number in GCash bill receipts", async () => {
    const msg = await load("gcash/gbills-eastwest.eml");
    expect(msg.text).toMatch(/\*{12}\d{4}/);
    expect(msg.text).not.toMatch(/\d{13,19}/);
  });
});
