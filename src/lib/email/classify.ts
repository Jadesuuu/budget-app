import { readForwardingConfirmation } from "./gmail";
import { domainOf, type Message } from "./message";
import { parsedTransactionSchema, type ParsedTransaction, type TemplateParser } from "./parsers/types";

export type Institution = { id: string; slug: string; name: string; emailDomains: string[] };
export type Account = { id: string; institutionId: string; type: string; last4: string | null; archived: boolean };

export type ClassifyContext = {
  institutions: Institution[];
  accounts: Account[];
  /** Mailboxes the user forwards from (lowercase). */
  forwardingSources: string[];
  parsers: TemplateParser[];
};

/** What should happen to one raw email. Pure: the job runner performs the writes. */
export type Outcome =
  | { kind: "gmail_confirmation"; code: string; requestedBy: string }
  | { kind: "transaction"; parser: string; parserVersion: number; accountId: string; transaction: ParsedTransaction }
  | { kind: "info"; note: string; parser: string; parserVersion: number }
  | { kind: "flagged"; note: string }
  | { kind: "failed"; note: string; parser?: string; parserVersion?: number };

export function senderInstitution(from: string, institutions: Institution[]): Institution | null {
  const domain = domainOf(from);
  if (!domain) return null;
  return institutions.find((i) => i.emailDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) ?? null;
}

export function classify(msg: Message, ctx: ClassifyContext): Outcome {
  const confirmation = readForwardingConfirmation(msg);
  if (confirmation) return { kind: "gmail_confirmation", ...confirmation };

  if (msg.forwardedBy && !ctx.forwardingSources.includes(msg.forwardedBy)) {
    return { kind: "flagged", note: `Forwarded from ${msg.forwardedBy}, which isn't one of your addresses.` };
  }
  if (msg.authFailed) {
    return { kind: "flagged", note: "The sender couldn't be verified, so this may not really be from your bank." };
  }

  const institution = senderInstitution(msg.from, ctx.institutions);
  if (!institution) {
    return { kind: "flagged", note: `${msg.from || "Unknown sender"} isn't a known bank or e-wallet sender.` };
  }

  const parser = ctx.parsers.find((p) => p.institution === institution.slug && p.matches(msg));
  if (!parser) return { kind: "failed", note: `No reader for this ${institution.name} email yet.` };

  const tag = { parser: parser.id, parserVersion: parser.version };
  let candidate: ParsedTransaction | null;
  try {
    candidate = parser.parse(msg);
  } catch {
    return { kind: "failed", note: "Couldn't read this email.", ...tag };
  }
  if (!candidate) {
    return parser.info ? { kind: "info", note: parser.info, ...tag } : { kind: "failed", note: "This email doesn't contain a transaction.", ...tag };
  }
  const parsed = parsedTransactionSchema.safeParse(candidate);
  if (!parsed.success) return { kind: "failed", note: "Couldn't read the amount or date in this email.", ...tag };

  const accountId = matchAccount(parsed.data, institution, ctx.accounts);
  if (!accountId) {
    const hint = parsed.data.last4 ? ` ending in ${parsed.data.last4}` : "";
    return { kind: "failed", note: `Add your ${institution.name} account${hint} so this can be matched.`, ...tag };
  }
  return { kind: "transaction", ...tag, accountId, transaction: parsed.data };
}

// Messages rarely say whether a deposit account is "savings" or "debit"; treat them as one family.
const DEPOSIT = new Set(["savings", "debit"]);
const sameFamily = (a: string, b: string) => a === b || (DEPOSIT.has(a) && DEPOSIT.has(b));

/** Same institution, then last 4 digits, then account type; only an unambiguous match counts. */
export function matchAccount(tx: ParsedTransaction, institution: Institution, accounts: Account[]): string | null {
  let pool = accounts.filter((a) => a.institutionId === institution.id && !a.archived);
  if (tx.last4) pool = pool.filter((a) => a.last4 === tx.last4);
  if (pool.length > 1 && tx.accountType) pool = pool.filter((a) => sameFamily(a.type, tx.accountType!));
  return pool.length === 1 ? pool[0].id : null;
}
