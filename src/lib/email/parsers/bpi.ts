import { field, maskedLast4 } from "@/lib/parsing/fields";
import { manilaDateTime, pesoAmount } from "@/lib/parsing/values";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/bpi/

/** "Incoming Interbank Funds Transfer Confirmation" (InstaPay into a BPI account). */
export const bpiInstapayIncoming: TemplateParser = {
  id: "bpi.instapay-incoming",
  version: 1,
  institution: "bpi",
  matches: (m) => m.from === "bpiinstapay@bpi.com.ph" && /incoming interbank funds transfer/i.test(m.subject),
  parse: (m) => {
    const amount = pesoAmount(field(m.text, "Transfer Amount") ?? "");
    const occurredAt = manilaDateTime(field(m.text, "Transaction Date and Time") ?? "") ?? m.date;
    if (!amount || !occurredAt) return null;
    const bank = field(m.text, "Bank Name")?.replace(/,?\s*Inc\.?$/i, "");
    return {
      amountCentavos: amount,
      occurredAt,
      merchant: `InstaPay from ${bank ?? "another bank"}`,
      last4: maskedLast4(field(m.text, "Transfer To")),
      accountType: "savings",
    };
  },
};

const BPI_ONLINE = "onlinebanking@bpi.com.ph";

/** "Interbank Funds Transfer Confirmation" (InstaPay out of a BPI account, e.g. to GCash). */
export const bpiInstapayOutgoing: TemplateParser = {
  id: "bpi.instapay-outgoing",
  version: 1,
  institution: "bpi",
  matches: (m) => m.from === BPI_ONLINE && /^interbank funds transfer confirmation/i.test(m.subject),
  parse: (m) => {
    const amount = pesoAmount(field(m.text, "Transfer Amount") ?? "");
    const occurredAt = manilaDateTime(field(m.text, "Transaction Date and Time") ?? "") ?? m.date;
    if (!amount || !occurredAt) return null;
    const fee = pesoAmount(field(m.text, "Service Fee") ?? "");
    const bank = field(m.text, "Bank Name")?.replace(/,?\s*Inc\.?$/i, "");
    return {
      amountCentavos: -amount,
      feeCentavos: fee || undefined,
      occurredAt,
      merchant: `Transfer to ${bank ?? "another bank"}`,
      last4: maskedLast4(field(m.text, "Transfer From")?.replace(/\s*\(.*$/, "") ?? null),
      accountType: "savings",
    };
  },
};

/** "Pay ... via QR" (QR Ph payment from a BPI account, e.g. "Pay TikTok PayLater Repayment via QR"). */
export const bpiQrPayment: TemplateParser = {
  id: "bpi.qr-payment",
  version: 1,
  institution: "bpi",
  matches: (m) => m.from === BPI_ONLINE && /^pay .+ via qr$/i.test(m.subject),
  parse: (m) => {
    // The email opens with a "Pay To Merchant Confirmation" heading; read only the details block.
    const start = m.text.search(/Pay via QR Details/i);
    const text = start >= 0 ? m.text.slice(start) : m.text;
    const amount = pesoAmount(field(text, "Amount") ?? "");
    const occurredAt = manilaDateTime(field(text, "Date and Time") ?? "") ?? m.date;
    if (!amount || !occurredAt) return null;
    return {
      amountCentavos: -amount,
      occurredAt,
      merchant: field(text, "Pay To") ?? "QR payment",
      last4: maskedLast4(field(text, "Pay From")?.replace(/\s*\(.*$/, "") ?? null),
      accountType: "savings",
    };
  },
};
