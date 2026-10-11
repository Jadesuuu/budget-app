import "server-only";
import type { Account } from "@/lib/email/classify";
import { insertParsedTransaction } from "@/lib/parsing/insert";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyCapture, type CaptureContext, type CaptureInstitution } from "./classify";
import { MESSAGE_PARSERS } from "./parsers";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function loadCaptureInstitutions(db: AdminClient): Promise<CaptureInstitution[]> {
  const { data, error } = await db.from("institutions").select("id, slug, name, sms_senders, app_packages").is("user_id", null);
  if (error) throw error;
  return data.map((i) => ({ id: i.id, slug: i.slug ?? "", name: i.name, smsSenders: i.sms_senders, appPackages: i.app_packages }));
}

export type CaptureRunSummary = { processed: number; transactions: number; info: number; flagged: number; failed: number };

/** Parses pending captured messages. Safe to re-run: a message never produces a second transaction. */
export async function processPendingMessages(options: { userId?: string; limit?: number } = {}): Promise<CaptureRunSummary> {
  const db = createAdminClient();
  const summary: CaptureRunSummary = { processed: 0, transactions: 0, info: 0, flagged: 0, failed: 0 };

  let query = db
    .from("raw_messages")
    .select("id, user_id, channel, sender, title, body, received_at")
    .eq("status", "pending")
    .order("received_at")
    .limit(options.limit ?? 100);
  if (options.userId) query = query.eq("user_id", options.userId);
  const { data: messages, error } = await query;
  if (error) throw error;
  if (messages.length === 0) return summary;

  const institutions = await loadCaptureInstitutions(db);
  const accountsByUser = new Map<string, Account[]>();
  async function contextFor(userId: string): Promise<CaptureContext> {
    let accounts = accountsByUser.get(userId);
    if (!accounts) {
      const result = await db.from("accounts").select("id, institution_id, type, last4, archived_at").eq("user_id", userId);
      if (result.error) throw result.error;
      accounts = result.data.map((a) => ({ id: a.id, institutionId: a.institution_id, type: a.type, last4: a.last4, archived: a.archived_at !== null }));
      accountsByUser.set(userId, accounts);
    }
    return { institutions, accounts, parsers: MESSAGE_PARSERS };
  }

  for (const m of messages) {
    summary.processed++;
    const parsedAt = new Date().toISOString();
    const msg = { channel: m.channel as "sms" | "notification", sender: m.sender, title: m.title, body: m.body ?? "", receivedAt: m.received_at };
    const outcome = classifyCapture(msg, m.received_at, await contextFor(m.user_id));

    if (outcome.kind === "transaction") {
      await insertParsedTransaction(db, {
        userId: m.user_id,
        accountId: outcome.accountId,
        tx: outcome.transaction,
        source: "sms",
        rawMessageId: m.id,
      });
      await db
        .from("raw_messages")
        .update({ status: "parsed", parser: outcome.parser, parser_version: outcome.parserVersion, note: null, parsed_at: parsedAt })
        .eq("id", m.id);
      summary.transactions++;
    } else if (outcome.kind === "info") {
      await db
        .from("raw_messages")
        .update({ status: "parsed", parser: outcome.parser, parser_version: outcome.parserVersion, note: outcome.note, parsed_at: parsedAt })
        .eq("id", m.id);
      summary.info++;
    } else {
      // A sender that turns out not to be a bank loses its content, same as at capture time.
      const unknownSender = outcome.kind === "flagged";
      await db
        .from("raw_messages")
        .update({
          status: outcome.kind,
          note: outcome.note,
          parser: outcome.kind === "failed" ? (outcome.parser ?? null) : null,
          parser_version: outcome.kind === "failed" ? (outcome.parserVersion ?? null) : null,
          parsed_at: parsedAt,
          ...(unknownSender ? { body: null, title: null } : {}),
        })
        .eq("id", m.id);
      summary[outcome.kind]++;
    }
  }
  return summary;
}
