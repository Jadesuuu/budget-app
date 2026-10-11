import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { classify, type Account, type ClassifyContext, type Institution } from "./classify";
import { insertParsedTransaction, recordStatement } from "@/lib/parsing/insert";
import { readMessage } from "./message";
import { TEMPLATE_PARSERS } from "./parsers";

export type RunSummary = {
  processed: number;
  transactions: number;
  statements: number;
  confirmations: number;
  info: number;
  flagged: number;
  failed: number;
};

/**
 * Parses pending raw emails. Safe to re-run: an email that already produced a transaction never produces a second.
 * Pass userId to limit the run to one person (used by "Try again" in Settings).
 */
export async function processPendingEmails(options: { limit?: number; userId?: string } = {}): Promise<RunSummary> {
  const db = createAdminClient();
  const summary: RunSummary = { processed: 0, transactions: 0, statements: 0, confirmations: 0, info: 0, flagged: 0, failed: 0 };

  let query = db.from("raw_emails").select("id, user_id, raw_mime").eq("status", "pending").order("received_at").limit(options.limit ?? 50);
  if (options.userId) query = query.eq("user_id", options.userId);
  const { data: emails, error } = await query;
  if (error) throw error;
  if (emails.length === 0) return summary;

  const institutionsResult = await db.from("institutions").select("id, slug, name, email_domains").is("user_id", null);
  if (institutionsResult.error) throw institutionsResult.error;
  const institutions: Institution[] = institutionsResult.data.map((i) => ({
    id: i.id,
    slug: i.slug ?? "",
    name: i.name,
    emailDomains: i.email_domains,
  }));

  const contexts = new Map<string, ClassifyContext>();
  async function contextFor(userId: string): Promise<ClassifyContext> {
    const cached = contexts.get(userId);
    if (cached) return cached;
    const [accounts, sources] = await Promise.all([
      db.from("accounts").select("id, institution_id, type, last4, archived_at").eq("user_id", userId),
      db.from("forwarding_sources").select("email").eq("user_id", userId),
    ]);
    if (accounts.error) throw accounts.error;
    if (sources.error) throw sources.error;
    const ctx: ClassifyContext = {
      institutions,
      accounts: accounts.data.map<Account>((a) => ({
        id: a.id,
        institutionId: a.institution_id,
        type: a.type,
        last4: a.last4,
        archived: a.archived_at !== null,
      })),
      forwardingSources: sources.data.map((s) => s.email),
      parsers: TEMPLATE_PARSERS,
    };
    contexts.set(userId, ctx);
    return ctx;
  }

  for (const email of emails) {
    summary.processed++;
    const parsedAt = new Date().toISOString();
    let msg;
    try {
      msg = await readMessage(email.raw_mime);
    } catch {
      await db.from("raw_emails").update({ status: "failed", note: "Couldn't open this email.", parsed_at: parsedAt }).eq("id", email.id);
      summary.failed++;
      continue;
    }

    const outcome = classify(msg, await contextFor(email.user_id));
    const base = { original_from: msg.from || null, forwarded_by: msg.forwardedBy, parsed_at: parsedAt };

    if (outcome.kind === "gmail_confirmation") {
      const { error: upsertError } = await db.from("forwarding_sources").upsert(
        {
          user_id: email.user_id,
          email: outcome.requestedBy,
          added_by: "gmail_confirmation",
          confirmation_code: outcome.code,
          confirmation_received_at: parsedAt,
        },
        { onConflict: "user_id,email" },
      );
      if (upsertError) throw upsertError;
      contexts.delete(email.user_id);
      await db
        .from("raw_emails")
        .update({ ...base, status: "parsed", kind: "gmail_confirmation", note: `Gmail forwarding confirmation for ${outcome.requestedBy}` })
        .eq("id", email.id);
      summary.confirmations++;
    } else if (outcome.kind === "transaction") {
      await insertParsedTransaction(db, {
        userId: email.user_id,
        accountId: outcome.accountId,
        tx: outcome.transaction,
        source: "email",
        rawEmailId: email.id,
      });
      await db
        .from("raw_emails")
        .update({ ...base, status: "parsed", kind: "transaction", parser: outcome.parser, parser_version: outcome.parserVersion, note: null })
        .eq("id", email.id);
      summary.transactions++;
    } else if (outcome.kind === "statement") {
      await recordStatement(db, { userId: email.user_id, accountId: outcome.accountId, statement: outcome.statement, source: "email", rawEmailId: email.id });
      await db
        .from("raw_emails")
        .update({ ...base, status: "parsed", kind: "other", note: "Statement recorded", parser: outcome.parser, parser_version: outcome.parserVersion })
        .eq("id", email.id);
      summary.statements++;
    } else if (outcome.kind === "info") {
      await db
        .from("raw_emails")
        .update({ ...base, status: "parsed", kind: "other", note: outcome.note, parser: outcome.parser, parser_version: outcome.parserVersion })
        .eq("id", email.id);
      summary.info++;
    } else {
      await db
        .from("raw_emails")
        .update({
          ...base,
          status: outcome.kind,
          kind: "other",
          note: outcome.note,
          parser: outcome.kind === "failed" ? (outcome.parser ?? null) : null,
          parser_version: outcome.kind === "failed" ? (outcome.parserVersion ?? null) : null,
        })
        .eq("id", email.id);
      summary[outcome.kind]++;
    }
  }
  return summary;
}
