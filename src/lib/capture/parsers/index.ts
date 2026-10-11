import type { ParsedStatement, ParsedTransaction } from "@/lib/email/parsers/types";
import type { CapturedMessage } from "../payload";

export type MessageParser = {
  /** Stable id stored on raw_messages.parser, e.g. "bpi.card-sms". */
  id: string;
  version: number;
  /** Institution slug (institutions.slug). */
  institution: string;
  matches(msg: CapturedMessage): boolean;
  /** Same output contract as email parsers (parsedTransactionSchema). receivedAt is the fallback time. */
  parse(msg: CapturedMessage, receivedAt: string): ParsedTransaction | null;
  /** For statement and bill reminders: what's owed and when. */
  statement?(msg: CapturedMessage, receivedAt: string): ParsedStatement | null;
  /** Shown when parse returns null: what this kind of message is, e.g. "Statement reminder". */
  info?: string;
};

import { bpiSoaReminderSms, bpiTransferSms } from "./bpi";
import { gcashSms } from "./gcash";

/** One parser per SMS / notification template, each tested against redacted real samples in fixtures/messages/. */
export const MESSAGE_PARSERS: MessageParser[] = [gcashSms, bpiTransferSms, bpiSoaReminderSms];
