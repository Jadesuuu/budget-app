"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import { parsePesoInput } from "@/lib/money-input";

export type FormState = { status: "idle" } | { status: "error"; message: string; field?: string };

const ACCOUNT_TYPES = ["ewallet", "savings", "debit", "credit", "bnpl", "loan"] as const;
const OWED_TYPES = new Set(["credit", "bnpl", "loan"]);

const accountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(80, "Keep the name under 80 characters."),
  type: z.enum(ACCOUNT_TYPES, "Choose an account type."),
  last4: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "Last 4 digits must be exactly 4 numbers.")
    .transform((v) => v || null),
  balance: z.string().trim(),
  balanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of that balance."),
});

/**
 * When the opening balance applies. Today means "right now" (it already includes today's spending);
 * an earlier date means the start of that day in Manila.
 */
function openingBalanceAt(date: string): string | null {
  const today = todayInManila();
  if (date > today) return null;
  return date === today ? new Date().toISOString() : `${date}T00:00:00+08:00`;
}

/** Cash balances are positive; what you owe on cards, BNPL and loans is stored as a negative balance. */
function openingBalance(raw: string, type: string): number | null {
  if (raw === "" || raw === "0") return 0;
  const centavos = parsePesoInput(raw);
  if (centavos === null) return null;
  return OWED_TYPES.has(type) ? -centavos : centavos;
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const balance = openingBalance(parsed.data.balance, parsed.data.type);
  if (balance === null) return { status: "error", message: "Enter the balance as an amount, like 1,500.00.", field: "balance" };
  const balanceAt = openingBalanceAt(parsed.data.balanceDate);
  if (!balanceAt) return { status: "error", message: "The balance date can't be in the future.", field: "balanceDate" };

  const { supabase } = await requireUser();
  let institutionId = String(formData.get("institution") ?? "");
  let createdInstitution: string | null = null;

  if (institutionId === "__new") {
    const name = String(formData.get("newInstitution") ?? "").trim();
    if (!name || name.length > 80) return { status: "error", message: "Type the name of your bank or e-wallet.", field: "newInstitution" };
    const { data, error } = await supabase
      .from("institutions")
      .insert({ name, kind: parsed.data.type === "ewallet" ? "ewallet" : parsed.data.type === "bnpl" ? "bnpl" : "bank" })
      .select("id")
      .single();
    if (error) return { status: "error", message: "You already added a bank with that name. Pick it from the list." };
    institutionId = data.id;
    createdInstitution = data.id;
  } else if (!z.uuid().safeParse(institutionId).success) {
    return { status: "error", message: "Choose your bank or e-wallet.", field: "institution" };
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      institution_id: institutionId,
      type: parsed.data.type,
      name: parsed.data.name,
      last4: parsed.data.last4,
      opening_balance_centavos: balance,
      opening_balance_at: balanceAt,
    })
    .select("id")
    .single();
  if (error) {
    if (createdInstitution) await supabase.from("institutions").delete().eq("id", createdInstitution);
    return { status: "error", message: "Couldn't add the account. Check the details and try again." };
  }
  redirect(`/accounts/${data.id}`);
}

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!id.success || !parsed.success) {
    return { status: "error", message: parsed.success ? "That account couldn't be found." : parsed.error.issues[0].message };
  }
  const balance = openingBalance(parsed.data.balance, parsed.data.type);
  if (balance === null) return { status: "error", message: "Enter the balance as an amount, like 1,500.00.", field: "balance" };
  // Unchanged date keeps the exact original moment.
  const original = String(formData.get("originalBalanceAt") ?? "");
  const balanceAt =
    original && todayInManila(new Date(original)) === parsed.data.balanceDate ? original : openingBalanceAt(parsed.data.balanceDate);
  if (!balanceAt) return { status: "error", message: "The balance date can't be in the future.", field: "balanceDate" };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("accounts")
    .update({ name: parsed.data.name, last4: parsed.data.last4, opening_balance_centavos: balance, opening_balance_at: balanceAt })
    .eq("id", id.data);
  if (error) return { status: "error", message: "Couldn't save the changes. Try again." };
  redirect(`/accounts/${id.data}`);
}

export async function archiveAccount(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  redirect("/accounts");
}

export type CheckState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

/** "Update from your bank app": the balance the user sees right now becomes a checkpoint. */
export async function recordBankBalance(_prev: CheckState, formData: FormData): Promise<CheckState> {
  const id = z.uuid().safeParse(formData.get("accountId"));
  if (!id.success) return { status: "error", message: "That account couldn't be found." };
  const raw = String(formData.get("amount") ?? "").trim();
  const centavos = raw === "0" ? 0 : parsePesoInput(raw);
  if (centavos === null) return { status: "error", message: "Enter the balance as an amount, like 1,500.00." };

  const { supabase } = await requireUser();
  const account = await supabase.from("accounts").select("type").eq("id", id.data).maybeSingle();
  if (account.error || !account.data) return { status: "error", message: "That account couldn't be found." };
  const { error } = await supabase.from("balance_checkpoints").insert({
    account_id: id.data,
    balance_centavos: OWED_TYPES.has(account.data.type) ? -centavos : centavos,
    as_of: new Date().toISOString(),
    source: "manual",
  });
  if (error) return { status: "error", message: "Couldn't save the balance. Try again." };
  refresh();
  return { status: "saved" };
}
