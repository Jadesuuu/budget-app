import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, PiggyBank } from "lucide-react";
import { CategoryControls } from "@/components/category-controls";
import { PageHeader } from "@/components/page-header";
import { cachedUserData } from "@/lib/user-data";
import { getDueSoon } from "@/lib/data/due";
import { fixedSet, getCategories, getGoals, getSpendingHistory, getSpendingPlan, settingsMap } from "@/lib/data/spending";
import { addDays, todayInManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { expectedFixed, goalPlan, monthOf } from "@/lib/spending";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <>
      <PageHeader title="Plan" />
      <Suspense fallback={<div className="skeleton" style={{ height: 420 }} aria-busy="true" />}>
        <Plan />
      </Suspense>
    </>
  );
}

async function Plan() {
  "use cache: private";
  cachedUserData();
  const today = todayInManila();
  const [plan, categories, goals, due] = await Promise.all([getSpendingPlan(), getCategories(), getGoals(), getDueSoon()]);
  const { months } = await getSpendingHistory(monthOf(today), 2, fixedSet(categories));
  const [last, current] = months;
  const spentIn = (m: typeof last, id: string) => m.categories.find((c) => c.id === id)?.total ?? 0;

  const goalsPerMonth = goals.reduce((sum, g) => sum + (goalPlan(g, today).perMonth ?? 0), 0);
  const monthAhead = addDays(today, 30);
  const debtPerMonth = due.items
    .filter((d) => d.kind !== "statement" && d.dueDate <= monthAhead)
    .reduce((sum, d) => sum + d.fullAmount, 0);

  // Most-used first; categories with no spending and no settings wait behind "Show more".
  const rows = categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ ...c, thisMonth: spentIn(current, c.id), lastMonth: spentIn(last, c.id) }))
    .sort((a, b) => b.thisMonth + b.lastMonth - (a.thisMonth + a.lastMonth) || a.name.localeCompare(b.name));
  const active = rows.filter((r) => r.thisMonth + r.lastMonth > 0 || r.fixed || r.limit);
  const quiet = rows.filter((r) => !active.includes(r));

  return (
    <>
      <section className="settings-sec" aria-labelledby="plan-h">
        <h2 id="plan-h" className="settings-h">Payday and daily amount</h2>
        <p className="settings-p">
          Budget splits your everyday spending into a daily amount between paydays. Spend less today and the days after get more.
        </p>
        <PlanForm
          income={plan.income}
          limit={plan.limit}
          paydays={plan.paydays}
          goalsPerMonth={goalsPerMonth}
          fixedPerMonth={expectedFixed(settingsMap(categories), last, current)}
          debtPerMonth={debtPerMonth}
        />
      </section>

      <section className="settings-sec" aria-labelledby="cats-h">
        <h2 id="cats-h" className="settings-h">Categories</h2>
        <p className="settings-p">
          Mark rent, utilities and tuition as <b>fixed bills</b> so they stay out of your daily amount. A <b>limit</b> caps a
          category for the month; you&apos;re warned from 80%. Changes save on their own.
        </p>
        <ul className="row-list cat-rows">
          {active.map((r) => (
            <CategoryRow key={r.id} row={r} />
          ))}
        </ul>
        {quiet.length > 0 && (
          <details className="more-cats">
            <summary>Show {quiet.length} more {quiet.length === 1 ? "category" : "categories"} you haven&apos;t used</summary>
            <ul className="row-list cat-rows">
              {quiet.map((r) => (
                <CategoryRow key={r.id} row={r} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <Link href="/goals" className="plan-goals">
        <PiggyBank aria-hidden />
        <span>
          <b>Savings goals</b>
          <span className="hint">
            {goals.length === 0
              ? "Add one and it's set aside before your daily amount."
              : `${goals.length} ${goals.length === 1 ? "goal" : "goals"}${goalsPerMonth > 0 ? `, ${formatPeso(goalsPerMonth)} a month` : ""}`}
          </span>
        </span>
        <ChevronRight aria-hidden />
      </Link>
    </>
  );
}

function CategoryRow({ row }: { row: { id: string; name: string; fixed: boolean; limit: number | null; thisMonth: number; lastMonth: number } }) {
  return (
    <li className="cat-row" id={`cat-${row.id}`}>
      <div className="cat-row-head">
        <p className="row-title">{row.name}</p>
        <p className="row-sub">
          {row.thisMonth + row.lastMonth === 0 ? "Not used yet" : `${formatPeso(row.thisMonth)} this month · ${formatPeso(row.lastMonth)} last month`}
        </p>
      </div>
      <CategoryControls id={row.id} name={row.name} fixed={row.fixed} limit={row.limit} lastMonth={row.lastMonth} />
    </li>
  );
}
