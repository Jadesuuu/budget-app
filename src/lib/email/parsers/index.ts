import { atomeBill, atomeCardTransaction, atomeDueReminder, atomeRefund, tiktokPayLaterReminder } from "./atome";
import { bpiInstapayIncoming, bpiInstapayOutgoing, bpiQrPayment } from "./bpi";
import { eastwestAdvisory, eastwestEsoa } from "./eastwest";
import { gcashBankTransfer, gcashBillsPayment } from "./gcash";
import { spaylaterDueReminder } from "./spaylater";
import type { TemplateParser } from "./types";

/**
 * One parser per bank email template, each with redacted fixtures in fixtures/emails/<institution>/.
 * Parsers are added only from real (redacted) samples, never from guessed formats.
 */
export const TEMPLATE_PARSERS: TemplateParser[] = [
  gcashBankTransfer,
  gcashBillsPayment,
  bpiInstapayIncoming,
  bpiInstapayOutgoing,
  bpiQrPayment,
  atomeCardTransaction,
  atomeRefund,
  atomeBill,
  atomeDueReminder,
  tiktokPayLaterReminder,
  eastwestEsoa,
  eastwestAdvisory,
  spaylaterDueReminder,
];
