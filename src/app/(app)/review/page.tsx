import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review" />
      <Suspense fallback={<div className="skeleton" style={{ height: 160 }} aria-busy="true" />}>
        <PendingList />
      </Suspense>
    </>
  );
}

async function PendingList() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, merchant, amount_centavos, occurred_at, accounts(name, last4)")
    .eq("status", "pending")
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  if (data.length === 0) {
    return (
      <div className="empty">
        <h2>All caught up</h2>
        <p>When your bank and e-wallet emails arrive, each one becomes a transaction here for you to confirm or ignore.</p>
      </div>
    );
  }

  return (
    <ul className="row-list">
      {data.map((t) => {
        const account = t.accounts ? (t.accounts.last4 ? `${t.accounts.name} ••${t.accounts.last4}` : t.accounts.name) : "";
        const income = t.amount_centavos > 0;
        return (
          <li key={t.id} className="row">
            <div>
              <p className="row-title">{t.merchant ?? "Unknown merchant"}</p>
              <p className="row-sub">{account}</p>
            </div>
            <p className={income ? "row-amt in" : "row-amt"}>{formatPeso(t.amount_centavos, { signed: true })}</p>
          </li>
        );
      })}
    </ul>
  );
}
