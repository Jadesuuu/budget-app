import "server-only";
import { getSession } from "@/lib/auth";
import { findTransferPairs, type InboxItem, type InboxSource, type TransferPair } from "@/lib/inbox";

export type CategoryOption = { id: string; name: string; kind: "expense" | "income" | "transfer" };
export type AccountOption = { id: string; name: string; last4: string | null };

export type Inbox = {
  items: InboxItem[];
  pairs: TransferPair[];
  categories: CategoryOption[];
  accounts: AccountOption[];
};

export async function getInbox(): Promise<Inbox> {
  const { supabase } = await getSession();
  const [pending, categories, accounts] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, account_id, amount_centavos, occurred_at, merchant, source, category_id, duplicate_of, accounts(name, last4, institutions(name))")
      .eq("status", "pending")
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase.from("categories").select("id, name, kind").order("name"),
    supabase.from("accounts").select("id, name, last4").is("archived_at", null).order("name"),
  ]);
  if (pending.error) throw pending.error;
  if (categories.error) throw categories.error;
  if (accounts.error) throw accounts.error;

  const duplicateIds = [...new Set(pending.data.map((t) => t.duplicate_of).filter((id): id is string => Boolean(id)))];
  const duplicates = new Map<string, InboxItem["duplicateOf"]>();
  if (duplicateIds.length > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, merchant, amount_centavos, occurred_at, source")
      .in("id", duplicateIds);
    if (error) throw error;
    for (const d of data) {
      duplicates.set(d.id, { merchant: d.merchant, amount: d.amount_centavos, occurredAt: d.occurred_at, source: d.source as InboxSource });
    }
  }

  const items: InboxItem[] = pending.data.map((t) => ({
    id: t.id,
    accountId: t.account_id,
    accountName: t.accounts?.name ?? "Account",
    accountLast4: t.accounts?.last4 ?? null,
    institutionName: t.accounts?.institutions?.name ?? null,
    amount: t.amount_centavos,
    occurredAt: t.occurred_at,
    merchant: t.merchant,
    source: t.source as InboxSource,
    categoryId: t.category_id,
    duplicateOf: t.duplicate_of ? (duplicates.get(t.duplicate_of) ?? null) : null,
  }));

  return {
    items,
    pairs: findTransferPairs(items),
    categories: categories.data as CategoryOption[],
    accounts: accounts.data,
  };
}
