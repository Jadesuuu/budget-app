import { matchAccount, type Account, type Institution } from "@/lib/email/classify";
import { parsedStatementSchema, type ParsedStatement } from "@/lib/email/parsers/types";

export type StatementOutcome =
  | { kind: "statement"; accountId: string; statement: ParsedStatement }
  | { kind: "failed"; note: string };

/**
 * Validates a parsed statement and finds its account. A sender can act for another product
 * (Atome sends TikTok PayLater bills), so institutionSlug overrides the sender's institution.
 */
export function resolveStatement(
  candidate: ParsedStatement,
  sender: Pick<Institution, "id" | "slug" | "name">,
  institutions: Pick<Institution, "id" | "slug" | "name">[],
  accounts: Account[],
): StatementOutcome {
  const parsed = parsedStatementSchema.safeParse(candidate);
  if (!parsed.success) return { kind: "failed", note: "Couldn't read the amount or due date in this statement." };
  const owner = parsed.data.institutionSlug
    ? (institutions.find((i) => i.slug === parsed.data.institutionSlug) ?? null)
    : sender;
  if (!owner) return { kind: "failed", note: "This statement is for a product Budget doesn't know yet." };

  const accountId = matchAccount(
    { amountCentavos: 1, occurredAt: "2000-01-01T00:00:00Z", merchant: null, last4: parsed.data.last4, accountType: parsed.data.accountType },
    { ...owner, emailDomains: [] },
    accounts.filter((a) => ["credit", "bnpl", "loan"].includes(a.type)),
  );
  if (!accountId) {
    const hint = parsed.data.last4 ? ` ending in ${parsed.data.last4}` : "";
    return { kind: "failed", note: `Add your ${owner.name} account${hint} so its statements can be recorded.` };
  }
  return { kind: "statement", accountId, statement: parsed.data };
}
