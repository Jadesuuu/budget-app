import { atomeCardTransaction, atomeRefund, atomeReminders } from "./atome";
import { bpiInstapayIncoming } from "./bpi";
import { eastwestStatements } from "./eastwest";
import { gcashBankTransfer, gcashBillsPayment } from "./gcash";
import type { TemplateParser } from "./types";

/**
 * One parser per bank email template, each with redacted fixtures in fixtures/emails/<institution>/.
 * Parsers are added only from real (redacted) samples, never from guessed formats.
 */
export const TEMPLATE_PARSERS: TemplateParser[] = [
  gcashBankTransfer,
  gcashBillsPayment,
  bpiInstapayIncoming,
  atomeCardTransaction,
  atomeRefund,
  atomeReminders,
  eastwestStatements,
];
