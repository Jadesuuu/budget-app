import { z } from "zod";
import type { Message } from "../message";

const accountType = z.enum(["ewallet", "savings", "debit", "credit", "bnpl", "loan"]);
const centavos = z.number().int().refine((v) => Math.abs(v) <= 100_000_000_000, "amount out of range");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What every template parser (and any future fallback) must produce. Validated before anything is stored. */
export const parsedTransactionSchema = z.object({
  /** Signed integer centavos: negative = money out of the account. */
  amountCentavos: centavos.refine((v) => v !== 0, "amount must not be zero"),
  occurredAt: z.iso.datetime({ offset: true }),
  merchant: z.string().trim().min(1).max(200).nullable(),
  /** Last 4 digits of the card or account, if the email shows them. */
  last4: z.string().regex(/^\d{4}$/).nullable(),
  accountType: accountType.nullable(),
  /** A fee charged on top (e.g. InstaPay PHP 10). Stored as its own expense so transfer legs still match. */
  feeCentavos: z.number().int().positive().max(10_000_000).nullable().optional(),
  /** Balance the bank reports right after this transaction, in the app's sign (owed = negative). */
  balanceAfterCentavos: centavos.nullable().optional(),
});
export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

/** A statement or bill: what's owed and when. Becomes a statements row (and due date). */
export const parsedStatementSchema = z
  .object({
    /** Set when the sender acts for another product, e.g. Atome sending TikTok PayLater bills. */
    institutionSlug: z.string().min(1).nullable(),
    accountType: accountType.nullable(),
    last4: z.string().regex(/^\d{4}$/).nullable(),
    /** The statement (closing) date, when the message states one. Adds a balance checkpoint. */
    statementDate: day.nullable(),
    dueDate: day,
    /** Amount owed on the statement, positive. */
    totalCentavos: z.number().int().min(0).max(100_000_000_000),
    minimumCentavos: z.number().int().min(0).max(100_000_000_000).nullable(),
  })
  .refine((s) => !s.statementDate || s.statementDate <= s.dueDate, "statement date after due date");
export type ParsedStatement = z.infer<typeof parsedStatementSchema>;

export type TemplateParser = {
  /** Stable id stored on raw_emails.parser, e.g. "bpi.credit-card-alert". */
  id: string;
  /** Bump when the template logic changes, so old emails can be re-parsed. */
  version: number;
  /** Institution slug this template belongs to (matches institutions.slug). */
  institution: string;
  matches(msg: Message): boolean;
  /** Return null if the email matched but holds no transaction (e.g. a statement). */
  parse(msg: Message): ParsedTransaction | null;
  /** For statement and bill emails: what's owed and when. */
  statement?(msg: Message): ParsedStatement | null;
  /** Shown when neither a transaction nor a statement comes out, e.g. "Payment reminder". */
  info?: string;
};
