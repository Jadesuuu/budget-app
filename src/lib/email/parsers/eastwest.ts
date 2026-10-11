import type { TemplateParser } from "./types";

// Fixtures: fixtures/emails/eastwest/

/** e-SOA and minimum-payment advisories: statements, not transactions. Read for due dates in a later update. */
export const eastwestStatements: TemplateParser = {
  id: "eastwest.statement",
  version: 1,
  institution: "eastwest",
  matches: (m) =>
    (m.from === "e-soa@eastwestbanker.com" && /statement of account/i.test(m.subject)) ||
    (m.from.endsWith("eastwestbanker.com") && /credit card advisory/i.test(m.subject)),
  parse: () => null,
  info: "Credit card statement or payment reminder. Statements are added in a later update.",
};
