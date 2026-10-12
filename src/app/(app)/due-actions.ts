"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { parsePesoInput } from "@/lib/money-input";
import { userDataChanged } from "@/lib/user-data";

export type DueState = { status: "idle" | "saved" } | { status: "error"; message: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const billSchema = z.object({
  accountId: z.uuid(),
  dueDate: date,
  statementDate: z.union([date, z.literal("")]),
  balance: z.string().trim(),
  minimum: z.string().trim(),
});

/**
 * A bill typed in from the bank app or a paper statement. Same row an email or text would create, so a later
 * email for the same due date updates it instead of adding a second one.
 */
export async function addBill(_prev: DueState, formData: FormData): Promise<DueState> {
  const parsed = billSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Pick the due date." };
  const balance = parsePesoInput(parsed.data.balance);
  if (balance === null) return { status: "error", message: "Enter the amount due, like 18,450.20." };
  const minimum = parsed.data.minimum === "" ? balance : parsePesoInput(parsed.data.minimum);
  if (minimum === null) return { status: "error", message: "Enter the minimum as an amount, or leave it empty." };
  if (minimum > balance) return { status: "error", message: "The minimum can't be more than the amount due." };
  const statementDate = parsed.data.statementDate || parsed.data.dueDate;
  if (statementDate > parsed.data.dueDate) return { status: "error", message: "The statement date comes before the due date." };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("statements").upsert(
    {
      account_id: parsed.data.accountId,
      period_end: statementDate,
      due_date: parsed.data.dueDate,
      statement_balance_centavos: balance,
      minimum_due_centavos: minimum,
      source: "manual",
    },
    { onConflict: "account_id,due_date" },
  );
  if (error?.code === "23514") return { status: "error", message: "Bills can only be added to cards, buy now pay later and loans." };
  if (error) return { status: "error", message: "Couldn't save the bill. Try again." };
  userDataChanged();
  return { status: "saved" };
}

const keySchema = z.string().regex(/^(statement|loan|installment):[0-9a-f-]{36}$/);

export type PaidResult =
  | { status: "saved"; message: string; /** What to restore on Undo. */ undo: { key: string; previousPaid: number | null } }
  | { status: "error"; message: string };

const paidSchema = z.object({
  key: keySchema,
  // Card statements: what was paid. Loans and installments are simply paid.
  pay: z.enum(["minimum", "full", "other"]).optional(),
  amount: z.string().trim().optional(),
});

/**
 * Due soon's "Paid". A card statement records what was paid on top of earlier payments (the minimum, the whole
 * balance, or another amount); a loan or installment payment gets its paid date. Returns what Undo needs.
 */
export async function markDuePaid(input: { key: string; pay?: "minimum" | "full" | "other"; amount?: string }): Promise<PaidResult> {
  const parsed = paidSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "That bill couldn't be found." };
  const [kind, id] = parsed.data.key.split(":") as ["statement" | "loan" | "installment", string];
  const { supabase } = await requireUser();

  if (kind === "statement") {
    const row = await supabase
      .from("statements")
      .select("statement_balance_centavos, minimum_due_centavos, amount_paid_centavos")
      .eq("id", id)
      .maybeSingle();
    if (row.error || !row.data) return { status: "error", message: "That bill couldn't be found." };
    const { statement_balance_centavos: balance, minimum_due_centavos: minimum, amount_paid_centavos: before } = row.data;
    let paidNow: number;
    if (parsed.data.pay === "minimum") paidNow = Math.max(0, minimum - before);
    else if (parsed.data.pay === "other") {
      const amount = parsePesoInput(parsed.data.amount ?? "");
      if (amount === null) return { status: "error", message: "Enter what you paid, like 5,000." };
      paidNow = amount;
    } else paidNow = Math.max(0, balance - before);
    const after = Math.min(Math.max(0, balance), before + paidNow);
    const { error } = await supabase.from("statements").update({ amount_paid_centavos: after }).eq("id", id);
    if (error) return { status: "error", message: "Couldn't update it. Try again." };
    userDataChanged();
    const message =
      after >= balance ? "Marked paid in full." : after >= minimum ? `Minimum paid. ${formatPeso(balance - after)} left to pay in full.` : `${formatPeso(paidNow)} recorded.`;
    return { status: "saved", message, undo: { key: parsed.data.key, previousPaid: before } };
  }

  const table = kind === "loan" ? "loan_payments" : "installment_payments";
  const { data, error } = await supabase.from(table).update({ paid_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error || !data?.length) return { status: "error", message: "Couldn't update it. Try again." };
  userDataChanged();
  return { status: "saved", message: "Marked paid.", undo: { key: parsed.data.key, previousPaid: null } };
}

/** Undo for markDuePaid: puts back what was paid before, or clears the paid date. */
export async function undoDuePaid(undo: { key: string; previousPaid: number | null }): Promise<DueState> {
  const parsed = z.object({ key: keySchema, previousPaid: z.number().int().min(0).nullable() }).safeParse(undo);
  if (!parsed.success) return { status: "error", message: "Couldn't undo." };
  const [kind, id] = parsed.data.key.split(":") as ["statement" | "loan" | "installment", string];
  const { supabase } = await requireUser();
  const { error } =
    kind === "statement"
      ? await supabase.from("statements").update({ amount_paid_centavos: parsed.data.previousPaid ?? 0 }).eq("id", id)
      : await supabase.from(kind === "loan" ? "loan_payments" : "installment_payments").update({ paid_at: null }).eq("id", id);
  if (error) return { status: "error", message: "Couldn't undo. Try again." };
  userDataChanged();
  return { status: "saved" };
}
