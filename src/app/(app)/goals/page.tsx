import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Private } from "@/components/private-amount";
import { cachedUserData } from "@/lib/user-data";
import { getAccountsWithBalances } from "@/lib/data/accounts";
import { getGoals } from "@/lib/data/spending";
import { todayInManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { goalPlan } from "@/lib/spending";
import { archiveGoal } from "./actions";
import { GoalForm, MoveMoneyForm } from "./goal-forms";

export const metadata: Metadata = { title: "Savings goals" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader title="Savings goals" />
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} aria-busy="true" />}>
        <Goals />
      </Suspense>
    </>
  );
}

const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

async function Goals() {
  "use cache: private";
  cachedUserData();
  const today = todayInManila();
  const [goals, accounts] = await Promise.all([getGoals(), getAccountsWithBalances()]);
  const cashAccounts = accounts.filter((a) => ["ewallet", "savings", "debit"].includes(a.type)).map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      {goals.length > 0 && (
        <ul className="goal-list">
          {goals.map((g) => {
            const p = goalPlan(g, today);
            const pct = Math.min(100, Math.floor((g.saved / g.target) * 100));
            return (
              <li key={g.id} className="goal-card">
                <div className="goal-head">
                  <h2 className="goal-name">{g.name}</h2>
                  <p className="goal-pct num">{pct}%</p>
                </div>
                <p className="goal-amounts num">
                  <b>{g.account ? <Private>{formatPeso(g.saved)}</Private> : formatPeso(g.saved)}</b> <span>of {formatPeso(g.target)}</span>
                </p>
                <div className="meter" role="img" aria-label={`${pct}% of ${formatPeso(g.target)} saved`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <p className="goal-plan">
                  {p.reached ? (
                    <><CircleCheck aria-hidden /> Reached. Nice.</>
                  ) : p.late ? (
                    <><CircleAlert aria-hidden /> {formatPeso(p.remaining)} to go; the date ({longDate(g.targetDate!)}) has passed. Pick a new one below.</>
                  ) : p.perMonth !== null ? (
                    <>
                      Put aside <b>{formatPeso(p.perMonth)}</b> a month ({p.monthsLeft === 1 ? "this month" : `${p.monthsLeft} months, counting this one`})
                      to reach it by {longDate(g.targetDate!)}. That&apos;s about {formatPeso(p.perDay!)} a day.
                    </>
                  ) : (
                    <>{formatPeso(p.remaining)} to go. Add a date to see how much to put aside each month.</>
                  )}
                </p>
                {g.account ? (
                  <p className="hint">Follows your {g.account.name} balance. Move money into that account to grow it.</p>
                ) : (
                  <MoveMoneyForm id={g.id} name={g.name} />
                )}
                <details className="edit-details">
                  <summary>Edit goal</summary>
                  <GoalForm today={today} accounts={cashAccounts}
                    existing={{ id: g.id, name: g.name, target: g.target, targetDate: g.targetDate, accountId: g.account?.id ?? null }} />
                  <form action={archiveGoal} className="archive-form">
                    <input type="hidden" name="id" value={g.id} />
                    <p className="hint">Removing a goal only removes it from Budget. Your money stays where it is.</p>
                    <button className="btn" type="submit">Remove goal</button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <section className="settings-sec" aria-labelledby="new-goal-h">
        <h2 id="new-goal-h" className="settings-h">{goals.length ? "Add another goal" : "Add a goal"}</h2>
        <p className="settings-p">
          Budget keeps track of what you&apos;ve put aside; the money itself stays in your bank or e-wallet.
          With a date, goals also lower the suggested spending limit on the Spending page.
        </p>
        <GoalForm today={today} accounts={cashAccounts} />
      </section>
    </>
  );
}
