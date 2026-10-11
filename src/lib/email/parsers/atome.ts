import { todayInManila } from "@/lib/dates";
import { dayMonthNoYear, isoDay } from "@/lib/parsing/dates";
import { pesoAmount } from "@/lib/parsing/values";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/atome/. Atome also runs TikTok PayLater and sends its reminders.
const ATOME = "no-reply@service.atome.ph";

/** "Transaction Confirmation: <merchant>": an Atome Card or QR Ph purchase. */
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

/** "Your Atome Card bill statement is ready": outstanding bill, bill date and due date (no year). */
export const atomeBill: TemplateParser = {
  id: "atome.bill",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /bill statement is ready/i.test(m.subject),
  parse: () => null,
  statement: (m) => {
    const total = pesoAmount(/Outstanding bill:\s*(₱\s?[\d,]+\.\d{2})/i.exec(m.text)?.[1] ?? "");
    const billDate = dayMonthNoYear(/Bill Date:\s*([^\n]+)/i.exec(m.text)?.[1] ?? "", m.date ?? "");
    const dueDate = dayMonthNoYear(/Due Date:\s*([^\n]+)/i.exec(m.text)?.[1] ?? "", m.date ?? "");
    if (total === null || !dueDate || !m.date) return null;
    return { institutionSlug: null, accountType: "bnpl", last4: null, statementDate: billDate, dueDate, totalCentavos: total, minimumCentavos: null };
  },
  info: "Atome bill.",
};

/** "Atome Card Due date Reminder": "an amount of PHP 9,987.45 that needs to be settled on 2026-08-27". */
export const atomeDueReminder: TemplateParser = {
  id: "atome.due-reminder",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /due date reminder/i.test(m.subject),
  parse: () => null,
  statement: (m) => {
    const match = /amount of\s+(PHP\s?[\d,]+\.\d{2}) that needs to be settled on\s+(\d{4}-\d{2}-\d{2})/i.exec(m.text);
    const total = match ? pesoAmount(match[1]) : null;
    const dueDate = match ? isoDay(match[2]) : null;
    if (total === null || !dueDate) return null;
    return { institutionSlug: null, accountType: "bnpl", last4: null, statementDate: null, dueDate, totalCentavos: total, minimumCentavos: null };
  },
  info: "Atome due-date reminder.",
};

/** "TikTok PayLater Payment Reminder": due today, filed under the TikTok PayLater account, not the Atome Card. */
export const tiktokPayLaterReminder: TemplateParser = {
  id: "atome.tiktok-paylater-reminder",
  version: 1,
  institution: "atome",
  matches: (m) => m.from === ATOME && /tiktok paylater/i.test(m.subject),
  parse: () => null,
  statement: (m) => {
    const total = pesoAmount(/amounting to\s+(Php\s?[\d,]+\.\d{2})/i.exec(m.text)?.[1] ?? "");
    if (total === null || !m.date || !/due today/i.test(m.text)) return null;
    return {
      institutionSlug: "tiktok-shop",
      accountType: "bnpl",
      last4: null,
      statementDate: null,
      dueDate: todayInManila(new Date(m.date)),
      totalCentavos: total,
      minimumCentavos: null,
    };
  },
  info: "TikTok PayLater reminder.",
};
