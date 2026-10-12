import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, PiggyBank, Repeat, SlidersHorizontal } from "lucide-react";
import { CategoryControls } from "@/components/category-controls";
import { DueList } from "@/components/due-list";
import { PageHeader } from "@/components/page-header";
import { Private } from "@/components/private-amount";
import { cachedUserData } from "@/lib/user-data";
import { fixedSet, getBudgetToday, getCategories, getSpendingHistory, settingsMap } from "@/lib/data/spending";
import { addDays, dayAndMonth, monthName, todayInManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import {
  addMonths,
  cumulative,
  daysInMonth,
  findRepeatCharges,
  isMonth,
  limitStatuses,
  monthOf,
  spentByDay,
  type LimitStatus,
  type MonthSpending,
  type RepeatCharge,
} from "@/lib/spending";
import { PaceChart } from "./pace-chart";
import { PeriodRibbon } from "./period-ribbon";

export const metadata: Metadata = { title: "Spending" };

const HISTORY = 6;
const TOP_COLORS = 5;

export default function SpendingPage({ searchParams }: PageProps<"/spending">) {
  return (
    <>
      <PageHeader title="Spending" balances />
      <Suspense fallback={<div className="skeleton-stack" aria-busy="true" aria-label="Loading"><div className="skeleton" style={{ height: 220 }} /><div className="skeleton" style={{ height: 160 }} /></div>}>
        <Spending searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Spending({ searchParams }: Pick<PageProps<"/spending">, "searchParams">) {
  const { m } = await searchParams;
  return <SpendingView month={isMonth(m) ? m : null} />;
}

const shortMonth = (month: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const fullMonth = (month: string) => monthName(`${month}-01`);
const shortDate = (date: string) => {
  const { day, month } = dayAndMonth(date);
  return `${month} ${Number(day)}`;
};
/** Bank merchant strings arrive as "NETFLIX.COM"; show them the way people say them. */
const merchantName = (name: string) =>
  name === name.toUpperCase() ? name.toLowerCase().replace(/(^|\s)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : name;

async function SpendingView({ month: requested }: { month: string | null }) {
  "use cache: private";
  cachedUserData();
  const today = todayInManila();
  const thisMonth = monthOf(today);
  const month = requested && requested <= thisMonth ? requested : thisMonth;
  const isCurrent = month === thisMonth;

  const [categories, budget] = await Promise.all([getCategories(), isCurrent ? getBudgetToday() : null]);
  const fixed = fixedSet(categories);
  const { months: history, txns } = await getSpendingHistory(month, HISTORY, fixed);
  const cur = history[HISTORY - 1];
  const prev = history[HISTORY - 2];
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month);
  const limits = limitStatuses(cur, settingsMap(categories), new Map(categories.map((c) => [c.id, c.name])));
  const repeats = isCurrent ? findRepeatCharges(txns, today) : [];
  const lastMonthBy = new Map(prev.categories.map((c) => [c.id, c.total]));

  return (
    <>
      {budget && <PayPeriod budget={budget} />}
      {budget && <BeforePayday budget={budget} />}

      <section className="month-sec" aria-labelledby="month-h">
        <div className="month-head">
          <h2 id="month-h">{isCurrent ? `${fullMonth(month)} so far` : `${fullMonth(month)} ${month.slice(0, 4)}`}</h2>
          <nav className="month-steps" aria-label="Month">
            <Link className="step" href={`/spending?m=${addMonths(month, -1)}`} aria-label={`Show ${fullMonth(addMonths(month, -1))}`}>
              <ChevronLeft aria-hidden />
            </Link>
            {isCurrent ? (
              <span className="step" aria-hidden data-disabled><ChevronRight /></span>
            ) : (
              <Link className="step" href={addMonths(month, 1) === thisMonth ? "/spending" : `/spending?m=${addMonths(month, 1)}`} aria-label={`Show ${fullMonth(addMonths(month, 1))}`}>
                <ChevronRight aria-hidden />
              </Link>
            )}
          </nav>
        </div>
        <MonthSentence month={cur} prev={prev} isCurrent={isCurrent} dayOfMonth={dayOfMonth} />
        <Categories month={cur} limits={limits} lastMonthBy={lastMonthBy} editable={isCurrent} />
      </section>

      {repeats.length > 0 && <RepeatCharges repeats={repeats} />}

      <details className="trends">
        <summary>
          <span>Trends</span>
          <span className="hint">Against last month, top places, last {HISTORY} months</span>
        </summary>
        <div className="trends-body">
          <section aria-labelledby="pace-h">
            <h3 id="pace-h" className="sub-h">Everyday spending against {fullMonth(prev.month)}</h3>
            <PaceChart
              current={cumulative(cur.daily).slice(0, dayOfMonth)}
              previous={cumulative(prev.daily)}
              daysInMonth={cur.daily.length}
              limit={null}
              monthShort={shortMonth(month)}
              prevMonthShort={shortMonth(prev.month)}
            />
          </section>
          <Merchants month={cur} />
          <MonthsChart history={history} selected={month} thisMonth={thisMonth} />
        </div>
      </details>

      <ul className="link-list spending-links">
        <li>
          <Link href="/spending/plan">
            <SlidersHorizontal aria-hidden />
            <span>Plan: payday, daily amount, limits and fixed bills</span>
            <ChevronRight aria-hidden className="chev" />
          </Link>
        </li>
        <li>
          <Link href="/goals">
            <PiggyBank aria-hidden />
            <span>Savings goals</span>
            <ChevronRight aria-hidden className="chev" />
          </Link>
        </li>
      </ul>
    </>
  );
}

type Budget = Awaited<ReturnType<typeof getBudgetToday>>;

/** The page's lead: today's amount and the pay period, payday to payday, day by day. */
function PayPeriod({ budget }: { budget: Budget }) {
  const { allowance: a, period, daily, dayIndex } = budget;
  const paydayLabel = shortDate(addDays(period.end, 1));

  if (!a) {
    return (
      <section className="period period-setup" aria-labelledby="period-h">
        <h2 id="period-h" className="period-lead">How much can you spend today?</h2>
        <p className="period-sub">Tell Budget your payday and how much you want for everyday spending. It splits that into a daily amount and adjusts it as you go.</p>
        <Link href="/spending/plan" className="btn primary">Set up your plan</Link>
      </section>
    );
  }

  const over = a.leftToday < 0;
  const periodOver = a.leftForPeriod < 0;
  return (
    <section className="period" aria-labelledby="period-h">
      <h2 id="period-h" className="period-lead">
        {over && <CircleAlert aria-hidden className="lead-alert" />}
        <span className="num">{formatPeso(Math.abs(a.leftToday))}</span>{" "}
        <span className="lead-words">{over ? "over today's amount" : "left for today"}</span>
      </h2>
      <p className="period-sub">
        {periodOver ? (
          <>{formatPeso(-a.leftForPeriod)} over your {formatPeso(a.budget)} until payday on {paydayLabel}.</>
        ) : (
          <>
            {formatPeso(a.leftForPeriod)} of {formatPeso(a.budget)} left until payday on {paydayLabel}
            {a.daysLeft > 1 && <>, about {formatPeso(a.perDayAfterToday)} a day after today</>}.
          </>
        )}
      </p>
      <p className="period-note">
        {over && a.daysLeft > 1 && !periodOver
          ? `Today went ${formatPeso(-a.leftToday)} over, so each day after gets a little less: ${formatPeso(a.perDayAfterToday)}.`
          : periodOver
            ? "You've used this pay period's amount. Anything more comes out of the next one."
            : "Spend less today and the days after get more."}
      </p>
      <PeriodRibbon
        start={period.start}
        daily={daily}
        todayIndex={dayIndex}
        evenShare={a.perDay}
        todayShare={a.todayShare}
        perDayAfter={a.perDayAfterToday}
      />
    </section>
  );
}

/** Due before spent: what has to come out of this pay period before anything else. */
function BeforePayday({ budget }: { budget: Budget }) {
  const { safe, period, today } = budget;
  const paydayLabel = shortDate(addDays(period.end, 1));
  return (
    <section aria-labelledby="before-h">
      <div className="sec-head">
        <h2 id="before-h">Before payday</h2>
        <span className="sec-sub">Due by {shortDate(period.end)}</span>
      </div>
      <DueList today={today} items={budget.duesBeforeList} emptyText={`No bills due before payday on ${paydayLabel}.`} />
      {safe.cash !== 0 &&
        (safe.safe < 0 ? (
          <p className="cash-flag">
            <CircleAlert aria-hidden />
            <span>
              Your e-wallets and bank accounts are <Private>{formatPeso(-safe.safe)}</Private> short of these bills
              {safe.earmarked > 0 && " and your goal money"}. Move money in or plan which to pay first.
            </span>
          </p>
        ) : (
          <p className="cash-note">
            After these, your e-wallets and bank accounts have <Private>{formatPeso(safe.safe)}</Private>
            {safe.earmarked > 0 && <>, not counting <Private>{formatPeso(safe.earmarked)}</Private> set aside for goals</>}.
          </p>
        ))}
    </section>
  );
}

function MonthSentence({ month, prev, isCurrent, dayOfMonth }: { month: MonthSpending; prev: MonthSpending; isCurrent: boolean; dayOfMonth: number }) {
  const everyday = month.spent - month.fixedSpent;
  const prevBase = isCurrent ? spentByDay(prev.daily, dayOfMonth) : prev.spent;
  const diff = (isCurrent ? everyday : month.spent) - prevBase;
  const compareDay = `${shortMonth(prev.month)} ${Math.min(dayOfMonth, prev.daily.length)}`;
  return (
    <div className="month-sentence">
      <p>
        <b className="num">{formatPeso(month.spent)}</b> spent
        {month.fixedSpent > 0 && <>, {formatPeso(month.fixedSpent)} of it fixed bills</>}.
        {prevBase > 0 && diff !== 0 && (
          <>
            {" "}
            {isCurrent ? "Everyday spending is " : ""}
            <b className="num">{formatPeso(Math.abs(diff))} {diff > 0 ? "more" : "less"}</b>{" "}
            {isCurrent ? <>than by <span className="nowrap">{compareDay}</span>.</> : <>than {fullMonth(prev.month)}.</>}
          </>
        )}
        {month.income > 0 && <> Money in: <span className="in num">+{formatPeso(month.income)}</span>.</>}
      </p>
      {month.pendingOut > 0 && (
        <p className="hint">
          Not counted yet: {formatPeso(month.pendingOut)} in {month.pendingCount} {month.pendingCount === 1 ? "transaction" : "transactions"} still{" "}
          <Link href="/review">to review</Link>.
        </p>
      )}
    </div>
  );
}

function Categories({ month, limits, lastMonthBy, editable }: { month: MonthSpending; limits: LimitStatus[]; lastMonthBy: Map<string, number>; editable: boolean }) {
  const limitBy = new Map(limits.map((l) => [l.id, l]));
  const unspent = limits.filter((l) => !month.categories.some((c) => c.id === l.id));
  if (month.spent <= 0 && unspent.length === 0) {
    return <p className="quiet-empty">Nothing spent yet. Confirmed purchases show up here by category.</p>;
  }
  const whole = Math.max(1, month.spent);
  const color = (i: number) => (i < TOP_COLORS ? `var(--s${i + 1})` : "var(--line-strong)");
  const rows = [
    ...month.categories.map((c, i) => ({ id: c.id, name: c.name, total: c.total, fixed: c.fixed, color: color(i) })),
    ...unspent.map((l) => ({ id: l.id, name: l.name, total: 0, fixed: false, color: "var(--surface-2)" })),
  ];

  return (
    <div className="where">
      <h3 className="sub-h">Where it went</h3>
      {month.spent > 0 && (
        <div className="bar" aria-hidden>
          {month.categories.slice(0, TOP_COLORS).map((c, i) => (
            <i key={c.id} style={{ width: `${(c.total / whole) * 100}%`, background: color(i) }} />
          ))}
          {month.categories.length > TOP_COLORS && (
            <i style={{ width: `${(month.categories.slice(TOP_COLORS).reduce((s, c) => s + c.total, 0) / whole) * 100}%`, background: color(TOP_COLORS) }} />
          )}
        </div>
      )}
      <ul className="cat-list">
        {rows.map((r) => {
          const l = limitBy.get(r.id);
          return (
            <li key={r.id}>
              <div className="cat-line">
                <span className="k">
                  <span className="dot" style={{ background: r.color }} aria-hidden />
                  {r.name}
                  {r.fixed && <span className="tag">Fixed</span>}
                </span>
                <span className="v">
                  {formatPeso(r.total)}
                  {r.total > 0 && <span className="pct"> · {Math.round((r.total / whole) * 100)}%</span>}
                </span>
              </div>
              {l && <LimitMeter l={l} />}
              {l && editable && (
                <details className="cat-edit">
                  <summary>Change limit<span className="vh"> for {r.name}</span></summary>
                  <CategoryControls compact id={r.id} name={r.name} fixed={r.fixed} limit={l.limit} lastMonth={lastMonthBy.get(r.id) ?? 0} />
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <Link href="/spending/plan#cats-h" className="where-foot">
          {limits.length ? "Set limits and fixed bills" : "Set a limit on a category"}
          <ChevronRight aria-hidden />
        </Link>
      )}
    </div>
  );
}

function LimitMeter({ l }: { l: LimitStatus }) {
  const pct = Math.min(100, Math.round((l.spent / l.limit) * 100));
  return (
    <div className="cat-limit-row">
      <div className="meter thin" aria-hidden>
        <i style={{ width: `${pct}%` }} data-over={l.state === "over" || undefined} />
      </div>
      <span className={`limit-note ${l.state}`}>
        {l.state !== "ok" && <CircleAlert aria-hidden />}
        {l.state === "over"
          ? `${formatPeso(l.spent - l.limit)} over the ${formatPeso(l.limit)} limit`
          : l.state === "near"
            ? `${Math.floor((l.spent / l.limit) * 100)}% of the ${formatPeso(l.limit)} limit, ${formatPeso(l.limit - l.spent)} left`
            : `${formatPeso(l.limit - l.spent)} left of ${formatPeso(l.limit)}`}
      </span>
    </div>
  );
}

function RepeatCharges({ repeats }: { repeats: RepeatCharge[] }) {
  const monthly = repeats.reduce((s, r) => s + r.amount, 0);
  return (
    <section aria-labelledby="repeat-h">
      <div className="sec-head">
        <h2 id="repeat-h">Subscriptions</h2>
        <span className="sec-sub">About {formatPeso(monthly)} a month</span>
      </div>
      <ul className="row-list">
        {repeats.map((r) => (
          <li key={r.merchant} className="row repeat-row">
            <Repeat aria-hidden className="row-icon" />
            <div className="row-main">
              <p className="row-title">{merchantName(r.merchant)}</p>
              <p className="row-sub">Next around {shortDate(r.next)} · {r.times} months in a row</p>
            </div>
            <p className="row-amt">{formatPeso(-r.amount)}</p>
          </li>
        ))}
      </ul>
      <p className="hint repeat-hint">Spotted from charges of about the same amount every month. Cancel the ones you don&apos;t use.</p>
    </section>
  );
}

function Merchants({ month }: { month: MonthSpending }) {
  if (month.merchants.length === 0) return null;
  return (
    <section aria-labelledby="merch-h">
      <h3 id="merch-h" className="sub-h">Top places</h3>
      <ul className="row-list">
        {month.merchants.slice(0, 5).map((m) => (
          <li key={m.name} className="row">
            <div>
              <p className="row-title">{merchantName(m.name)}</p>
              <p className="row-sub">{m.count} {m.count === 1 ? "time" : "times"}</p>
            </div>
            <p className="row-amt">{formatPeso(-m.total)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MonthsChart({ history, selected, thisMonth }: { history: MonthSpending[]; selected: string; thisMonth: string }) {
  const max = Math.max(1, ...history.map((h) => h.spent));
  const full = history.filter((h) => h.spent > 0 && h.month !== thisMonth);
  const average = full.length ? Math.round(full.reduce((s, h) => s + h.spent, 0) / full.length) : 0;
  return (
    <section aria-labelledby="months-h">
      <h3 id="months-h" className="sub-h">
        Last {history.length} months{average > 0 && <span className="sub-h-note"> · average {formatPeso(average)}</span>}
      </h3>
      <ol className="months">
        {history.map((h) => (
          <li key={h.month}>
            <Link
              href={h.month === thisMonth ? "/spending" : `/spending?m=${h.month}`}
              aria-current={h.month === selected ? "true" : undefined}
              aria-label={`${fullMonth(h.month)}: ${formatPeso(h.spent)} spent${h.month === thisMonth ? " so far" : ""}`}
            >
              <span className="months-v num">{h.spent > 0 ? formatPeso(h.spent).replace(/\.\d\d$/, "") : "–"}</span>
              <span className="months-track"><i style={{ height: `${Math.max(0, (h.spent / max) * 100)}%` }} data-partial={h.month === thisMonth || undefined} /></span>
              <span className="months-m">{shortMonth(h.month)}{h.month === thisMonth && <span className="so-far"> so far</span>}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
