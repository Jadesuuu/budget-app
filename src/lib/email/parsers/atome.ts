import { pesoAmount } from "@/lib/parsing/values";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/atome/. Atome also sends TikTok PayLater emails.
const ATOME = "no-reply@service.atome.ph";

/** "Transaction Confirmation: <merchant>" — an Atome Card or QR Ph purchase. */
export const atomeCardTransaction: TemplateParser = {
  id: "atome.card-transaction",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /^Transaction Confirmation:/i.test(m.subject),
  parse: (m) => {
    const match = /your payment of\s+(₱\s?[\d,]+\.\d{2})\s+for\s+(.+?)\s+using\s+(.+?)\s+has been successfully processed/i.exec(m.text);
    if (!match || !m.date) return null;
    const amount = pesoAmount(match[1]);
    if (!amount) return null;
    return {
      amountCentavos: -amount,
      occurredAt: m.date,
      merchant: match[2].trim(),
      last4: /ending in \*?(\d{4})/i.exec(match[3])?.[1] ?? null,
      accountType: "bnpl",
    };
  },
};

/** "Refund Confirmation: ₱..." */
export const atomeRefund: TemplateParser = {
  id: "atome.refund",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /^Refund Confirmation/i.test(m.subject),
  parse: (m) => {
    const amount = pesoAmount(/received a refund of\s+(₱\s?[\d,]+(?:\.\d{2})?)/i.exec(m.text)?.[1] ?? "");
    if (!amount || !m.date) return null;
    return { amountCentavos: amount, occurredAt: m.date, merchant: "Atome refund", last4: null, accountType: "bnpl" };
  },
};

/** Bills, due-date and TikTok PayLater reminders: recognised, used for due dates later, never transactions. */
export const atomeReminders: TemplateParser = {
  id: "atome.reminder",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /(bill statement|due date reminder|paylater payment reminder)/i.test(m.subject),
  parse: () => null,
  info: "Bill or due-date reminder. Due dates from these are added in a later update.",
};
