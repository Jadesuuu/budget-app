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
