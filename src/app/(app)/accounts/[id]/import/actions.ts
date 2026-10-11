"use server";

import { userDataChanged } from "@/lib/user-data";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { readImportFile } from "@/lib/import/read";
import { closingBalance, matchImport, type ExistingTransaction } from "@/lib/reconcile/match";

type Line = { occurredAt: string; amountCentavos: number; description: string };

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string; needsPassword?: boolean }
  | {
      status: "preview";
      fileName: string;
      total: number;
      matched: number;
      skipped: number;
      missing: Line[];
      notInFile: Line[];
      closing: { balanceCentavos: number; asOf: string } | null;
    }
  | { status: "done"; added: number; matched: number };

const DAY = 86_400_000;

/**
 * One action, two steps: intent=preview reads and matches the file; intent=commit does it again and saves.
 * The file and its password travel with each request and are never stored.
 */
export async function importFile(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const accountId = z.uuid().safeParse(formData.get("accountId"));
  const file = formData.get("file");
  if (!accountId.success) return { status: "error", message: "That account couldn't be found." };
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a CSV or PDF file first." };
  const password = String(formData.get("password") ?? "") || undefined;
  const commit = formData.get("intent") === "commit";

  const { supabase } = await requireUser();
  const account = await supabase.from("accounts").select("id, type").eq("id", accountId.data).maybeSingle();
  if (account.error || !account.data) return { status: "error", message: "That account couldn't be found." };

  const read = await readImportFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, password);
  if (!read.ok) return { status: "error", message: read.error, needsPassword: read.needsPassword };

  const rows = read.rows;
  const times = rows.map((r) => Date.parse(r.occurredAt));
  const from = new Date(Math.min(...times) - 2 * DAY).toISOString();
  const to = new Date(Math.max(...times) + 2 * DAY).toISOString();
  const existing = await supabase
    .from("transactions")
    .select("id, occurred_at, amount_centavos, merchant, status")
    .eq("account_id", accountId.data)
    .in("status", ["pending", "confirmed"])
    .gte("occurred_at", from)
    .lte("occurred_at", to);
  if (existing.error) return { status: "error", message: "Couldn't load this account's transactions." };

  const match = matchImport(
    rows,
    existing.data.map<ExistingTransaction>((t) => ({
      id: t.id,
      occurredAt: t.occurred_at,
      amountCentavos: t.amount_centavos,
      merchant: t.merchant,
      status: t.status as "pending" | "confirmed",
    })),
  );
  const closing = closingBalance(rows);

  if (!commit) {
    return {
      status: "preview",
      fileName: file.name,
      total: rows.length,
      matched: match.matched.length,
      skipped: read.skipped,
      missing: match.missing,
      notInFile: match.notInFile.map((t) => ({ occurredAt: t.occurredAt, amountCentavos: t.amountCentavos, description: t.merchant ?? "Transaction" })),
      closing,
    };
  }

  const record = await supabase
    .from("imports")
    .insert({
      account_id: accountId.data,
      format: read.format,
      file_name: file.name.slice(0, 200),
      period_start: new Date(Math.min(...times)).toISOString(),
      period_end: new Date(Math.max(...times)).toISOString(),
      rows_total: rows.length,
      rows_matched: match.matched.length,
      rows_added: match.missing.length,
    })
    .select("id")
    .single();
  if (record.error) return { status: "error", message: "Couldn't save the import. Try again." };

  if (match.missing.length > 0) {
    const { error } = await supabase.from("transactions").insert(
      match.missing.map((r) => ({
        account_id: accountId.data,
        amount_centavos: r.amountCentavos,
        occurred_at: r.occurredAt,
        merchant: r.description.slice(0, 200),
        status: "pending" as const,
        source: "statement" as const,
        import_id: record.data.id,
      })),
    );
    if (error) {
      await supabase.from("imports").delete().eq("id", record.data.id);
      return { status: "error", message: "Couldn't add the transactions. Nothing was imported." };
    }
  }
  if (closing) {
    await supabase.from("balance_checkpoints").insert({
      account_id: accountId.data,
      balance_centavos: closing.balanceCentavos,
      as_of: closing.asOf,
      source: "import",
    });
  }
  userDataChanged();
  return { status: "done", added: match.missing.length, matched: match.matched.length };
}

export async function undoImport(formData: FormData) {
  const id = z.uuid().parse(formData.get("importId"));
  const { supabase } = await requireUser();
  // Cascades to the transactions this import added; nothing else is touched.
  const { error } = await supabase.from("imports").delete().eq("id", id);
  if (error) throw error;
  userDataChanged();
}
