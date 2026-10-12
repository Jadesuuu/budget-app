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

/**
 * QR Ph payment from a BPI account: "Pay TikTok PayLater Repayment via QR" (completed), or "Pay via QR
 * Notification" (processed, but BPI flags a possible error and refunds within 1-2 banking days if needed).
 */
export const bpiQrPayment: TemplateParser = {
  id: "bpi.qr-payment",
  version: 2,
  institution: "bpi",
  matches: (m) => m.from === BPI_ONLINE && /^pay (.+ )?via qr\b/i.test(m.subject),
  parse: (m) => {
    // The email opens with a "Pay To Merchant Confirmation" heading; read only the details block.
    const start = m.text.search(/Pay via QR (Transaction )?Details/i);
    const text = start >= 0 ? m.text.slice(start) : m.text;
    const amount = pesoAmount(field(text, "Amount") ?? "");
    const when = field(text, "Transaction Date and Time") ?? field(text, "Date and Time") ?? "";
    const occurredAt = manilaDateTime(when) ?? m.date;
    if (!amount || !occurredAt) return null;
    const payee = field(text, "Pay To") ?? "QR payment";
    const maybeFailed = /possible error/i.test(m.text);
    return {
      amountCentavos: -amount,
      occurredAt,
      merchant: maybeFailed ? `${payee} (BPI: may not have gone through)` : payee,
      last4: maskedLast4(field(text, "Pay From")?.replace(/\s*\(.*$/, "") ?? null),
      accountType: "savings",
    };
  },
};
