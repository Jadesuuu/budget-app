import { field, maskedLast4 } from "@/lib/parsing/fields";
import { manilaDateTime, pesoAmount } from "@/lib/parsing/values";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/gcash/

/** "GCash Bank Transfer" receipt (InstaPay out of GCash). The fee becomes its own expense. */
export const gcashBankTransfer: TemplateParser = {
  id: "gcash.bank-transfer",
  version: 1,
  institution: "gcash",
  matches: (m) => m.from === "noreply-banktransfer@gcash.com" && /bank transfer/i.test(m.subject),
  parse: (m) => {
    const amount = pesoAmount(field(m.text, "Transfer Amount") ?? "");
    const occurredAt = manilaDateTime(field(m.text, "Transfer Date") ?? "") ?? m.date;
    if (!amount || !occurredAt) return null;
    const bank = field(m.text, "Bank");
    const last4 = maskedLast4(field(m.text, "Account No."));
    const fee = pesoAmount(field(m.text, "+Fee") ?? "");
    return {
      amountCentavos: -amount,
      occurredAt,
      merchant: `Transfer to ${bank ?? "bank"}${last4 ? ` ••${last4}` : ""}`,
      last4: null,
      accountType: "ewallet",
      feeCentavos: fee || null,
    };
  },
};

/** "Your GBills Receipt for X" / "Your GCash Billspay Receipt for X". The fee becomes its own expense. */
export const gcashBillsPayment: TemplateParser = {
  id: "gcash.bills-payment",
  version: 1,
  institution: "gcash",
  matches: (m) => m.from === "no-reply@gcash.com" && /^Your (GBills|GCash Billspay) Receipt for /i.test(m.subject),
  parse: (m) => {
    const amount = pesoAmount(field(m.text, "Bill Amount") ?? "");
    // Receipts only show the date; the email is sent right after paying, so its timestamp is the payment time.
    if (!amount || !m.date) return null;
    const biller = m.subject.replace(/^Your (GBills|GCash Billspay) Receipt for /i, "").trim();
    const fee = pesoAmount(field(m.text, "Fee") ?? "");
    return {
      amountCentavos: -amount,
      occurredAt: m.date,
      merchant: biller || "Bills payment",
      last4: null,
      accountType: "ewallet",
      feeCentavos: fee || null,
    };
  },
};
