import "server-only";
import type { ParsedStatement, ParsedTransaction } from "@/lib/email/parsers/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type RawRef = { rawEmailId?: string; rawMessageId?: string };

let feeCategoryId: string | null | undefined;

async function feeCategory(db: AdminClient): Promise<string | null> {
  if (feeCategoryId !== undefined) return feeCategoryId;
  const { data } = await db.from("categories").select("id").is("user_id", null).eq("name", "Fees & interest").maybeSingle();
  feeCategoryId = data?.id ?? null;
  return feeCategoryId;
}

const rawColumns = (ref: RawRef) => ({ raw_email_id: ref.rawEmailId ?? null, raw_message_id: ref.rawMessageId ?? null });

/** One checkpoint per raw email/message: re-running the parse job never duplicates it. */
async function insertCheckpoint(
  db: AdminClient,
  input: { userId: string; accountId: string; balanceCentavos: number; asOf: string; source: "sms" | "email" } & RawRef,
) {
  const { error } = await db.from("balance_checkpoints").insert({
    user_id: input.userId,
    account_id: input.accountId,
    balance_centavos: input.balanceCentavos,
    as_of: input.asOf,
    source: input.source,
    ...rawColumns(input),
  });
  if (error && error.code !== "23505") throw error;
}

/**
 * Writes a parsed transaction (and its fee, if any) as pending items for review, plus a balance checkpoint
 * when the bank stated the balance. Idempotent per raw email or message.
 */
export async function insertParsedTransaction(
  db: AdminClient,
  input: { userId: string; accountId: string; tx: ParsedTransaction; source: "email" | "sms" } & RawRef,
): Promise<void> {
  const ref = input.rawEmailId ? { column: "raw_email_id", id: input.rawEmailId } : { column: "raw_message_id", id: input.rawMessageId! };
  const existing = await db.from("transactions").select("id").eq(ref.column, ref.id).limit(1);
  if (existing.error) throw existing.error;

  if (existing.data.length === 0) {
    const common = {
      user_id: input.userId,
      account_id: input.accountId,
      occurred_at: input.tx.occurredAt,
      status: "pending" as const,
      source: input.source,
      ...rawColumns(input),
    };
    const rows = [{ ...common, amount_centavos: input.tx.amountCentavos, merchant: input.tx.merchant }];
    if (input.tx.feeCentavos) {
      rows.push({ ...common, amount_centavos: -input.tx.feeCentavos, merchant: `${input.tx.merchant ?? "Transaction"} fee` });
    }
    const { data, error } = await db.from("transactions").insert(rows).select("id");
    if (error) throw error;
    if (input.tx.feeCentavos && data.length === 2) {
      const category = await feeCategory(db);
      if (category) await db.from("transactions").update({ category_id: category }).eq("id", data[1].id);
    }
  }

  if (input.tx.balanceAfterCentavos !== undefined && input.tx.balanceAfterCentavos !== null) {
    await insertCheckpoint(db, {
      userId: input.userId,
      accountId: input.accountId,
      balanceCentavos: input.tx.balanceAfterCentavos,
      asOf: input.tx.occurredAt,
      source: input.source,
      rawEmailId: input.rawEmailId,
      rawMessageId: input.rawMessageId,
    });
  }
}

/**
 * Records a statement or bill (one per account per due date; later messages update it) and, when the
 * statement date is known, a checkpoint: the account owed the total at the end of that day.
 */
export async function recordStatement(
  db: AdminClient,
  input: { userId: string; accountId: string; statement: ParsedStatement; source: "email" | "sms" } & RawRef,
): Promise<void> {
  const s = input.statement;
  const { error } = await db.from("statements").upsert(
    {
      user_id: input.userId,
      account_id: input.accountId,
      period_end: s.statementDate ?? s.dueDate,
      due_date: s.dueDate,
      statement_balance_centavos: s.totalCentavos,
      minimum_due_centavos: s.minimumCentavos ?? 0,
      source: input.source,
    },
    { onConflict: "account_id,due_date" },
  );
  if (error) throw error;

  if (s.statementDate) {
    await insertCheckpoint(db, {
      userId: input.userId,
      accountId: input.accountId,
      balanceCentavos: -s.totalCentavos,
      asOf: `${s.statementDate}T23:59:59+08:00`,
      source: input.source,
      rawEmailId: input.rawEmailId,
      rawMessageId: input.rawMessageId,
    });
  }
}
