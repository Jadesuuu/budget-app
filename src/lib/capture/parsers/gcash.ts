import { manilaDateTime, pesoAmount } from "@/lib/parsing/values";
import type { MessageParser } from "./index";

// Fixtures: fixtures/messages/gcash-sms.json
const AMOUNT = String.raw`P([\d,]+\.\d{2})`;
const WHEN = String.raw`(\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)`;

const TEMPLATES: { pattern: RegExp; sign: 1 | -1; merchant: (m: RegExpExecArray) => string; when: number }[] = [
  // You have paid P130.83 GCash to FFT*PINDUOD on 10-09-26 11:30:30 AM.
  { pattern: new RegExp(String.raw`You have paid ${AMOUNT} GCash to (.+?) on ${WHEN}`, "i"), sign: -1, merchant: (m) => m[2], when: 3 },
  // You have successfully withdrawn P1,018.00 from your GCash wallet with applicable fees on 10-08-26 07:41:00 PM
  { pattern: new RegExp(String.raw`You have successfully withdrawn ${AMOUNT} from your GCash wallet.*? on ${WHEN}`, "i"), sign: -1, merchant: () => "Cash out", when: 2 },
  // Your payment of P143.00 to Angkas has been successfully processed on 10-08-26 06:55:46 PM.
  { pattern: new RegExp(String.raw`Your payment of ${AMOUNT} to (.+?) has been successfully processed on ${WHEN}`, "i"), sign: -1, merchant: (m) => m[2], when: 3 },
  // You received P544.50 from 7 Eleven CI. New balance is P999.38 10-07-26 10:06PM.
  { pattern: new RegExp(String.raw`You received ${AMOUNT} from (.+?)\.\s+New balance is P[\d,]+\.\d{2}\s+${WHEN}`, "i"), sign: 1, merchant: (m) => `Received from ${m[2]}`, when: 3 },
  // Your refund of P169.00 from Grab Philippines has been successfully credited to your Gcash wallet on 10-07-26 07:07:38 AM.
  { pattern: new RegExp(String.raw`Your refund of ${AMOUNT} from (.+?) has been successfully credited.*? on ${WHEN}`, "i"), sign: 1, merchant: (m) => `Refund from ${m[2]}`, when: 3 },
];

export const gcashSms: MessageParser = {
  id: "gcash.sms",
  version: 1,
  institution: "gcash",
  matches: (msg) => TEMPLATES.some((t) => t.pattern.test(msg.body)),
  parse: (msg, receivedAt) => {
    for (const t of TEMPLATES) {
      const m = t.pattern.exec(msg.body);
      if (!m) continue;
      const amount = pesoAmount(m[1]);
      if (!amount) return null;
      return {
        amountCentavos: t.sign * amount,
        occurredAt: manilaDateTime(m[t.when]) ?? receivedAt,
        merchant: t.merchant(m).trim(),
        last4: null,
        accountType: "ewallet",
        // "Your new balance is P864.55" / "New balance is P999.38": a free balance checkpoint.
        balanceAfterCentavos: pesoAmount(/new balance is (P[\d,]+\.\d{2})/i.exec(msg.body)?.[1] ?? "") ?? null,
      };
    }
    return null;
  },
};
