"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
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
});

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

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("accounts")
    .update({ name: parsed.data.name, last4: parsed.data.last4, opening_balance_centavos: balance })
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
