import "server-only";
import type { ParsedTransaction } from "@/lib/email/parsers/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

let feeCategoryId: string | null | undefined;

async function feeCategory(db: AdminClient): Promise<string | null> {
  if (feeCategoryId !== undefined) return feeCategoryId;
  const { data } = await db.from("categories").select("id").is("user_id", null).eq("name", "Fees & interest").maybeSingle();
  feeCategoryId = data?.id ?? null;
  return feeCategoryId;
}

/**
 * Writes a parsed transaction (and its fee, if any) as pending items for review. Idempotent per raw email or
 * message: re-running the parse job never creates a second copy.
 */
export async function insertParsedTransaction(
  db: AdminClient,
  input: {
    userId: string;
    accountId: string;
    tx: ParsedTransaction;
    source: "email" | "sms";
    rawEmailId?: string;
    rawMessageId?: string;
  },
): Promise<void> {
  const ref = input.rawEmailId ? { column: "raw_email_id", id: input.rawEmailId } : { column: "raw_message_id", id: input.rawMessageId! };
  const existing = await db.from("transactions").select("id").eq(ref.column, ref.id).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data.length > 0) return;

  const common = {
    user_id: input.userId,
    account_id: input.accountId,
    occurred_at: input.tx.occurredAt,
    status: "pending" as const,
    source: input.source,
    raw_email_id: input.rawEmailId ?? null,
    raw_message_id: input.rawMessageId ?? null,
  };
  const rows = [{ ...common, amount_centavos: input.tx.amountCentavos, merchant: input.tx.merchant }];
  if (input.tx.feeCentavos) {
    rows.push({
      ...common,
      amount_centavos: -input.tx.feeCentavos,
      merchant: `${input.tx.merchant ?? "Transaction"} fee`,
      // category is set below; kept separate so the main row keeps whatever the user picks
    });
  }
  const { data, error } = await db.from("transactions").insert(rows).select("id, merchant");
  if (error) throw error;

  if (input.tx.feeCentavos && data.length === 2) {
    const category = await feeCategory(db);
    if (category) await db.from("transactions").update({ category_id: category }).eq("id", data[1].id);
  }
}
