import { z } from "zod";
import type { Message } from "../message";

/** What every template parser (and any future fallback) must produce. Validated before anything is stored. */
export const parsedTransactionSchema = z.object({
  /** Signed integer centavos: negative = money out of the account. */
  amountCentavos: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 100_000_000_000, "amount out of range"),
  occurredAt: z.iso.datetime({ offset: true }),
  merchant: z.string().trim().min(1).max(200).nullable(),
  /** Last 4 digits of the card or account, if the email shows them. */
  last4: z.string().regex(/^\d{4}$/).nullable(),
  accountType: z.enum(["ewallet", "savings", "debit", "credit", "bnpl", "loan"]).nullable(),
  /** A fee charged on top (e.g. InstaPay PHP 10). Stored as its own expense so transfer legs still match. */
  feeCentavos: z.number().int().positive().max(10_000_000).nullable().optional(),
});
export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

export type TemplateParser = {
  /** Stable id stored on raw_emails.parser, e.g. "bpi.credit-card-alert". */
  id: string;
  /** Bump when the template logic changes, so old emails can be re-parsed. */
  version: number;
  /** Institution slug this template belongs to (matches institutions.slug). */
  institution: string;
  matches(msg: Message): boolean;
  /** Return null if the email matched but holds no transaction (e.g. a statement reminder). */
  parse(msg: Message): ParsedTransaction | null;
  /** Shown when parse returns null: what this kind of email is, e.g. "Statement reminder". */
  info?: string;
};
