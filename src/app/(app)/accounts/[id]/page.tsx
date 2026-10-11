import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getInstitutionOptions, OWED_TYPES, TYPE_LABEL } from "@/lib/data/accounts";
import { describeWhen } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";
import { centavosToInput } from "@/lib/money-input";
import { AccountForm } from "../account-form";
import { archiveAccount } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320, marginTop: 24 }} aria-busy="true" />}>
      <Account params={params} />
    </Suspense>
  );
}

async function Account({ params }: { params: PageProps<"/accounts/[id]">["params"] }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [account, balance, history, institutions] = await Promise.all([
    supabase.from("accounts").select("id, name, type, last4, institution_id, opening_balance_centavos, institutions(name)").eq("id", id).maybeSingle(),
    supabase.from("account_balances").select("balance_centavos").eq("account_id", id).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, merchant, amount_centavos, occurred_at, status, transfer_id, categories(name)")
      .eq("account_id", id)
      .neq("status", "ignored")
      .order("occurred_at", { ascending: false })
      .limit(50),
    getInstitutionOptions(),
  ]);
  if (account.error || balance.error || history.error) throw account.error ?? balance.error ?? history.error;
  if (!account.data) notFound();

  const a = account.data;
  const owed = OWED_TYPES.has(a.type);
  const bal = balance.data?.balance_centavos ?? 0;

  return (
    <>
      <PageHeader title={a.name} />
      <section className="balance-card" aria-label="Balance">
        <p className="balance-label">{owed ? "You owe" : "Balance"}</p>
        <p className="balance-value">{formatPeso(owed ? -bal : bal)}</p>
        <p className="balance-meta">
          {[a.institutions?.name, TYPE_LABEL[a.type], a.last4 && `••${a.last4}`].filter(Boolean).join(", ")}
        </p>
      </section>

      <section aria-labelledby="history-h">
        <div className="sec-head"><h2 id="history-h">History</h2></div>
        {history.data.length === 0 ? (
          <p className="quiet-empty">No transactions yet. Confirmed ones from your emails and the ones you add show up here.</p>
        ) : (
          <ul className="row-list">
            {history.data.map((t) => (
              <li key={t.id} className="row">
                <div>
                  <p className="row-title">{t.merchant ?? "Transaction"}</p>
                  <p className="row-sub">
                    {[describeWhen(t.occurred_at), t.transfer_id ? "Transfer" : t.categories?.name, t.status === "pending" && "To review"]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                <p className={t.amount_centavos > 0 ? "row-amt in" : "row-amt"}>{formatPeso(t.amount_centavos, { signed: true })}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="edit-details">
        <summary>Edit account</summary>
        <AccountForm
          institutions={institutions}
          existing={{
            id: a.id,
            name: a.name,
            type: a.type,
            last4: a.last4,
            institutionId: a.institution_id,
            balanceInput: a.opening_balance_centavos === 0 ? "" : centavosToInput(a.opening_balance_centavos),
          }}
        />
        <form action={archiveAccount} className="archive-form">
          <input type="hidden" name="id" value={a.id} />
          <p className="hint">Archiving hides the account. Its transactions stay in your history.</p>
          <button className="btn" type="submit">Archive account</button>
        </form>
      </details>
    </>
  );
}
