import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Accounts" };

const GROUPS = [
  { title: "Cash & e-wallets", types: ["ewallet", "savings", "debit"] },
  { title: "Credit, BNPL & loans", types: ["credit", "bnpl", "loan"] },
] as const;

const TYPE_LABEL: Record<string, string> = {
  ewallet: "E-wallet",
  savings: "Savings",
  debit: "Debit",
  credit: "Credit card",
  bnpl: "Buy now, pay later",
  loan: "Loan",
};

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" />
      <Suspense fallback={<div className="skeleton" style={{ height: 160 }} aria-busy="true" />}>
        <AccountGroups />
      </Suspense>
    </>
  );
}

async function AccountGroups() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, last4, institutions(name, slug)")
    .is("archived_at", null)
    .order("name");
  if (error) throw error;

  if (data.length === 0) {
    return (
      <div className="empty">
        <h2>No accounts yet</h2>
        <p>Adding accounts, cards and loans comes in the next update. Your first accounts will appear here.</p>
      </div>
    );
  }

  return GROUPS.map((group) => {
    const accounts = data.filter((a) => (group.types as readonly string[]).includes(a.type));
    if (accounts.length === 0) return null;
    return (
      <section key={group.title} className="acct-group" aria-label={group.title}>
        <h2 className="group-title">{group.title}</h2>
        <ul className="acct-list">
          {accounts.map((a) => (
            <li key={a.id} className="acct">
              <span className="inst" aria-hidden>
                {(a.institutions?.name ?? a.name).slice(0, 3).toUpperCase()}
              </span>
              <div className="acct-name">
                <p>{a.name}</p>
                <p>{[TYPE_LABEL[a.type], a.last4 && `••${a.last4}`].filter(Boolean).join(", ")}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  });
}
