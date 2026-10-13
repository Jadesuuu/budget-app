import { usDate } from "@/lib/parsing/dates";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/spaylater/. Sent by Monee (Credit) Finance, the lender behind SPayLater.

/** "SPayLater Due Date Reminder": "your SPayLater bill is due on 10-15-2026". No amount, just the due date. */
export const spaylaterDueReminder: TemplateParser = {
  id: "spaylater.due-reminder",
  version: 1,
  institution: "spaylater",
  matches: (m) => m.from === "notification@mail.monee.com.ph" && /spaylater due date reminder/i.test(m.subject),
  parse: () => null,
  statement: (m) => {
    const dueDate = usDate(/bill is due on\s+(\d{1,2}-\d{1,2}-\d{4})/i.exec(m.text)?.[1] ?? "");
    if (!dueDate) return null;
    return { institutionSlug: null, accountType: "bnpl", last4: null, statementDate: null, dueDate, totalCentavos: null, minimumCentavos: null };
  },
  info: "SPayLater due-date reminder.",
};
