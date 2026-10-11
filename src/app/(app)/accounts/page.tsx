import type { Metadata } from "next";
import { cachedUserData } from "@/lib/user-data";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { BalanceCheckChip } from "@/components/balance-check";
import { PageHeader } from "@/components/page-header";
import { getAccountsWithBalances, OWED_TYPES, TYPE_LABEL } from "@/lib/data/accounts";
import { getBalanceChecks } from "@/lib/data/reconcile";
import { badgeFor } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";
import { Private } from "@/components/private-amount";

export const metadata: Metadata = { title: "Accounts" };

const GROUPS = [
  { title: "Cash & e-wallets", types: ["ewallet", "savings", "debit"] },
  { title: "Credit, BNPL & loans", types: ["credit", "bnpl", "loan"] },
] as const;

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" balances />
      <Suspense fallback={<div className="skeleton" style={{ height: 160 }} aria-busy="true" />}>
        <AccountGroups />
      </Suspense>
    </>
  );
}

async function AccountGroups() {
  "use cache: private";
  cachedUserData();
  const [accounts, checks] = await Promise.all([getAccountsWithBalances(), getBalanceChecks()]);

  if (accounts.length === 0) {
    return (
      <div className="empty">
        <h2>No accounts yet</h2>
        <p>Add the banks, e-wallets, cards and loans you use. Forwarded emails get matched to these accounts.</p>
        <Link href="/accounts/new" className="btn primary"><Plus aria-hidden />Add your first account</Link>
      </div>
    );
  }

  return (
    <>
      {GROUPS.map((group) => {
        const list = accounts.filter((a) => (group.types as readonly string[]).includes(a.type));
        if (list.length === 0) return null;
        const owed = OWED_TYPES.has(group.types[0]);
        const total = list.reduce((sum, a) => sum + a.balance, 0);
        return (
          <section key={group.title} className="acct-group" aria-label={group.title}>
            <div className="group-head">
              <h2 className="group-title">{group.title}</h2>
              <p className="group-total"><Private>{formatPeso(owed ? -total : total)}</Private>{owed && " owed"}</p>
            </div>
            <ul className="acct-list">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/accounts/${a.id}`} className="acct">
                    <span className="inst" aria-hidden>{badgeFor(a.institutionName ?? a.name)}</span>
                    <span className="acct-name">
                      <span className="acct-title">{a.name}</span>
                      <span className="acct-sub">
                        {[TYPE_LABEL[a.type], a.last4 && `••${a.last4}`, a.pending > 0 && `${a.pending} to review`].filter(Boolean).join(", ")}
                      </span>
                      <BalanceCheckChip check={checks.get(a.id)} bank={a.institutionName ?? a.name} />
                    </span>
                    <span className="acct-bal">
                      <Private>{OWED_TYPES.has(a.type) ? formatPeso(-a.balance) : formatPeso(a.balance)}</Private>
                      {OWED_TYPES.has(a.type) && <small>owed</small>}
                    </span>
                    <ChevronRight aria-hidden className="chev" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Link href="/accounts/new" className="btn"><Plus aria-hidden />Add account</Link>
    </>
  );
}
