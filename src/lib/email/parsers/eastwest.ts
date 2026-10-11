import { field } from "@/lib/parsing/fields";
import { monthDayYearUpper, usDate } from "@/lib/parsing/dates";
import { pesoAmount } from "@/lib/parsing/values";
import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/eastwest/

/** e-SOA email: the body summarises the statement (due date, minimum, total); the PDF stays unread. */
export const eastwestEsoa: TemplateParser = {
  id: "eastwest.esoa",
  version: 2,
  institution: "eastwest",
  matches: (m) => m.from === "e-soa@eastwestbanker.com" && /statement of account/i.test(m.subject),
  parse: () => null,
  statement: (m) => {
    const dueDate = usDate(field(m.text, "Payment Due Date") ?? "");
    const total = pesoAmount(field(m.text, "Total Statement Balance") ?? "");
    if (!dueDate || total === null) return null;
    return {
      institutionSlug: null,
      accountType: "credit",
      last4: null,
      // "...electronic-Statement of Account (e-SOA) for SEP 27 2026."
      statementDate: monthDayYearUpper(/\(e-SOA\) for ([A-Z]{3} \d{1,2} \d{4})/i.exec(m.text)?.[1] ?? ""),
      dueDate,
      totalCentavos: total,
      minimumCentavos: pesoAmount(field(m.text, "Minimum Payment Due") ?? ""),
    };
  },
  info: "EastWest statement.",
};

/** Minimum-payment advisories from the collections team: a reminder only, no statement total. */
export const eastwestAdvisory: TemplateParser = {
  id: "eastwest.advisory",
  version: 1,
  institution: "eastwest",
  matches: (m) => m.from.endsWith("eastwestbanker.com") && /credit card advisory/i.test(m.subject),
  parse: () => null,
  info: "Payment reminder for a statement you already have.",
};
