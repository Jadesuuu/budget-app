import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { DueList } from "@/components/due-list";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getDueSoon } from "@/lib/data/due";
import { getInbox } from "@/lib/data/inbox";
import { ReviewInbox } from "@/components/review-inbox";
import { monthName, todayInManila } from "@/lib/dates";

export default function HomePage() {
  return (
    <>
      <PageHeader
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
  const { supabase } = await requireUser();
  const [inbox, accounts, due] = await Promise.all([
    getInbox(),
    supabase.from("accounts").select("id", { count: "exact", head: true }).is("archived_at", null),
    getDueSoon(),
  ]);
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
  await connection();
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
