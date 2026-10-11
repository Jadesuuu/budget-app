import { manilaDateTime, pesoAmount } from "@/lib/parsing/values";
import type { MessageParser } from "./index";

// Fixtures: fixtures/messages/bpi-sms.json

/** BPI: You have transferred PHP 22,170.00 to GCash/G-Xchange on Sep 14 2026; 07:53:04 PM (GMT +8). */
const TRANSFER = /You have transferred PHP\s?([\d,]+\.\d{2}) to (.+?) on ([A-Z][a-z]{2} \d{1,2} \d{4};\s*\d{1,2}:\d{2}:\d{2}\s*[AP]M)/;

export const bpiTransferSms: MessageParser = {
  id: "bpi.transfer-sms",
  version: 1,
  institution: "bpi",
  matches: (msg) => TRANSFER.test(msg.body),
  parse: (msg, receivedAt) => {
    const m = TRANSFER.exec(msg.body);
    const amount = m ? pesoAmount(m[1]) : null;
    if (!m || !amount) return null;
    return {
      amountCentavos: -amount,
      occurredAt: manilaDateTime(m[3]) ?? receivedAt,
      merchant: `Transfer to ${m[2].trim()}`,
      last4: null,
      accountType: "savings",
    };
  },
};

/** "[BPI] This is a gentle reminder that your BPI Credit Card SOA ... is due ..." */
export const bpiSoaReminderSms: MessageParser = {
  id: "bpi.soa-reminder-sms",
  version: 1,
  institution: "bpi",
  matches: (msg) => /Credit Card SOA .* is due for payment/i.test(msg.body),
  parse: () => null,
  info: "Credit card due-date reminder. Due dates from these are added in a later update.",
};
