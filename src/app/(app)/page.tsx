import Link from "next/link";
import { cachedUserData } from "@/lib/user-data";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { DueList } from "@/components/due-list";
import { PageHeader } from "@/components/page-header";
import { cacheLife } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDueSoon } from "@/lib/data/due";
import { getInbox } from "@/lib/data/inbox";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getBalanceChecks } from "@/lib/data/reconcile";
import { formatPeso } from "@/lib/money";
import { Private } from "@/components/private-amount";
import { CircleAlert } from "lucide-react";
import { ReviewInbox } from "@/components/review-inbox";
import { monthName, todayInManila } from "@/lib/dates";

export default function HomePage() {
  return (
    <>
      <PageHeader
        balances
        title={
          <Suspense fallback="Home">
            <MonthTitle />
          </Suspense>
        }
      />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  "use cache: private";
  cachedUserData();
  const { supabase } = await getSession();
  const [inbox, accounts, due, checks, accountList] = await Promise.all([
    getInbox(),
    supabase.from("accounts").select("id", { count: "exact", head: true }).is("archived_at", null),
    getDueSoon(),
    getBalanceChecks(),
    getAccountsWithBalances(),
  ]);
  const offBalance = accountList.flatMap((a) => {
    const check = checks.get(a.id);
    return check?.state === "off" ? [{ ...a, gap: check.gapCentavos }] : [];
  });
  if (accounts.error) throw accounts.error;
  const pendingCount = inbox.items.length;
  const hasAccounts = (accounts.count ?? 0) > 0;

  return (
    <>
      {!hasAccounts && (
        <section className="setup-card" aria-labelledby="setup-h">
          <h2 id="setup-h">Set up in three steps</h2>
          <ol className="setup-steps">
            <li>
              <Link href="/accounts">
                <span>Add the accounts and cards you use</span>
                <ChevronRight aria-hidden />
              </Link>
            </li>
            <li>
              <Link href="/settings/email-setup">
                <span>Forward your bank emails to your Budget address</span>
                <ChevronRight aria-hidden />
              </Link>
            </li>
            <li>
              <span className="setup-step-static">Confirm what comes in, one tap each</span>
            </li>
          </ol>
        </section>
      )}

      {offBalance.length > 0 && (
        <section className="attention" aria-labelledby="attention-h">
          <h2 id="attention-h">Needs a look</h2>
          <ul>
            {offBalance.map((a) => (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`}>
                  <CircleAlert aria-hidden />
                  <span>
                    <b>{a.name}</b>: <Private>{formatPeso(Math.abs(a.gap))}</Private> unaccounted for
                  </span>
                  <ChevronRight aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="review-h">
        <div className="sec-head review-head">
          <div className="review-title">
            <h2 id="review-h">To review</h2>
            {pendingCount > 0 && <span className="review-count">{pendingCount}</span>}
          </div>
          <span className="sec-sub">From your emails and recurring bills</span>
        </div>
        {pendingCount > 0 ? (
          <ReviewInbox {...inbox} variant="home" />
        ) : (
          <p className="quiet-empty">Nothing to review. New transactions from your forwarded emails will show up here.</p>
        )}
      </section>

      <section aria-labelledby="due-h">
        <div className="sec-head">
          <h2 id="due-h">Due soon</h2>
        </div>
        <DueList today={due.today} items={due.items} />
      </section>
    </>
  );
}

async function MonthTitle() {
  "use cache";
  cacheLife("hours");
  return monthName(todayInManila());
}

function HomeSkeleton() {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 72 }} />
      <div className="skeleton" style={{ height: 72 }} />
    </div>
  );
}
