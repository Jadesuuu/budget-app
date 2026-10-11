import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FileUp } from "lucide-react";
import { BalanceCheckChip, describeCheck } from "@/components/balance-check";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getInstitutionOptions, OWED_TYPES, TYPE_LABEL } from "@/lib/data/accounts";
import { toCheck } from "@/lib/data/reconcile";
import { dayAndMonth, todayInManila } from "@/lib/dates";
import { describeWhen } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";
import { centavosToInput } from "@/lib/money-input";
import { AccountForm } from "../account-form";
import { archiveAccount } from "../actions";
import { BalanceForm } from "./balance-form";

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
  const [account, balance, check, history, statements, institutions] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, last4, institution_id, opening_balance_centavos, opening_balance_at, institutions(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("account_balances").select("balance_centavos").eq("account_id", id).maybeSingle(),
    supabase
      .from("account_reconciliation")
      .select("account_id, reported_centavos, confirmed_centavos, pending_centavos, as_of, source")
      .eq("account_id", id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, merchant, amount_centavos, occurred_at, status, transfer_id, categories(name)")
      .eq("account_id", id)
      .neq("status", "ignored")
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("statements")
      .select("id, period_end, due_date, statement_balance_centavos, minimum_due_centavos, amount_paid_centavos, source")
      .eq("account_id", id)
      .order("due_date", { ascending: false })
      .limit(6),
    getInstitutionOptions(),
  ]);
  if (account.error) throw account.error;
  if (balance.error) throw balance.error;
  if (check.error) throw check.error;
  if (history.error) throw history.error;
  if (statements.error) throw statements.error;
  if (!account.data) notFound();

  const a = account.data;
  const owed = OWED_TYPES.has(a.type);
  const bal = balance.data?.balance_centavos ?? 0;
  const bank = a.institutions?.name ?? a.name;
  const balanceCheck = check.data ? toCheck(check.data) : null;

  return (
    <>
      <PageHeader title={a.name} />
      <section className="balance-card" aria-label="Balance">
        <p className="balance-label">{owed ? "You owe" : "Balance"}</p>
        <p className="balance-value">{formatPeso(owed ? -bal : bal)}</p>
        <p className="balance-meta">{[a.institutions?.name, TYPE_LABEL[a.type], a.last4 && `••${a.last4}`].filter(Boolean).join(", ")}</p>
      </section>

      <section className="settings-sec" aria-labelledby="check-h">
        <div className="sec-head">
          <h2 id="check-h">Balance check</h2>
          <BalanceCheckChip check={balanceCheck ?? undefined} bank={bank} />
        </div>
        <p className="settings-p">
          {balanceCheck
            ? describeCheck(balanceCheck, bank, owed)
            : `No balance from ${bank} yet. Texts that state your balance, statements and imports check it automatically; you can also type what your app shows.`}
        </p>
        <BalanceForm accountId={a.id} owed={owed} bank={bank} />
        <Link href={`/accounts/${a.id}/import`} className="btn">
          <FileUp aria-hidden />
          Import history or statement
        </Link>
      </section>

      {statements.data.length > 0 && (
        <section aria-labelledby="statements-h">
          <div className="sec-head"><h2 id="statements-h">Statements</h2></div>
          <ul className="due-list">
            {statements.data.map((s) => {
              const { day, month } = dayAndMonth(s.due_date);
              return (
                <li key={s.id} className="due-row">
                  <div className="due-tile" aria-hidden>
                    <span className="d">{day}</span>
                    <span className="m">{month}</span>
                  </div>
                  <div>
                    <p className="due-name">Due {s.due_date}</p>
                    <p className="due-sub">
                      {s.minimum_due_centavos > 0 ? `Minimum ${formatPeso(s.minimum_due_centavos)}, ` : ""}from {s.source === "sms" ? "a text" : s.source}
                    </p>
                  </div>
                  <div className="due-amt">
                    <p className="v">{formatPeso(s.statement_balance_centavos)}</p>
                    <p className="l">{s.amount_paid_centavos >= s.statement_balance_centavos ? "Paid" : "Statement"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-h">
        <div className="sec-head"><h2 id="history-h">History</h2></div>
        {history.data.length === 0 ? (
          <p className="quiet-empty">No transactions yet. Confirmed ones from your texts and emails, imports, and the ones you add show up here.</p>
        ) : (
          <ul className="row-list">
            {history.data.map((t) => (
              <li key={t.id} className="row">
                <div>
                  <p className="row-title">{t.merchant ?? "Transaction"}</p>
                  <p className="row-sub">
                    {[describeWhen(t.occurred_at), t.transfer_id ? "Transfer" : t.categories?.name, t.status === "pending" && "To review",
                      t.occurred_at < a.opening_balance_at && "Before your starting balance"]
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
          today={todayInManila()}
          existing={{
            id: a.id,
            name: a.name,
            type: a.type,
            last4: a.last4,
            institutionId: a.institution_id,
            balanceInput: a.opening_balance_centavos === 0 ? "" : centavosToInput(a.opening_balance_centavos),
            balanceAt: a.opening_balance_at,
            balanceDate: todayInManila(new Date(a.opening_balance_at)),
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
