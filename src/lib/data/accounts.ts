import "server-only";
import { requireUser } from "@/lib/auth";
import type { InstitutionOption } from "@/app/(app)/accounts/account-form";

export const OWED_TYPES = new Set(["credit", "bnpl", "loan"]);

export const TYPE_LABEL: Record<string, string> = {
  ewallet: "E-wallet",
  savings: "Savings",
  debit: "Debit",
  credit: "Credit card",
  bnpl: "Buy now, pay later",
  loan: "Loan",
};

export async function getInstitutionOptions(): Promise<InstitutionOption[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("institutions").select("id, name, kind, user_id").order("name");
  if (error) throw error;
  return data.map((i) => ({ id: i.id, name: i.name, kind: i.kind, own: i.user_id === userId }));
}

export async function getAccountsWithBalances() {
  const { supabase } = await requireUser();
  const [accounts, balances] = await Promise.all([
    supabase.from("accounts").select("id, name, type, last4, institutions(name)").is("archived_at", null).order("name"),
    supabase.from("account_balances").select("account_id, balance_centavos, pending_count"),
  ]);
  if (accounts.error) throw accounts.error;
  if (balances.error) throw balances.error;
  const byId = new Map(balances.data.map((b) => [b.account_id, b]));
  return accounts.data.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    last4: a.last4,
    institutionName: a.institutions?.name ?? null,
    balance: byId.get(a.id)?.balance_centavos ?? 0,
    pending: byId.get(a.id)?.pending_count ?? 0,
  }));
}
