import type { Centavos } from "./money";
import { addDays, daysBetween, todayInManila } from "./dates";

// Months are "YYYY-MM" in Manila; days are "YYYY-MM-DD".

export type SpendingTxn = {
  amount: Centavos;
  occurredAt: string;
  merchant: string | null;
  category: { id: string; name: string; kind: "expense" | "income" | "transfer" } | null;
  /** Credit card, BNPL or loan: money in there is a payment or a refund, never income. */
  owedAccount: boolean;
  pending: boolean;
};

/**
 * What a transaction means for the month. Spending is positive centavos; a refund (money back with an
 * expense category) is negative spending. Transfers, card payments and uncategorized money into a card
 * count as neither.
 */
export function classify(t: SpendingTxn): { kind: "spend" | "income"; amount: Centavos } | null {
  if (t.category?.kind === "transfer") return null;
  if (t.amount < 0) return { kind: "spend", amount: -t.amount };
  if (t.category?.kind === "expense") return { kind: "spend", amount: -t.amount };
  if (t.owedAccount && t.category?.kind !== "income") return null;
  return { kind: "income", amount: t.amount };
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The instant a Manila day starts, for querying timestamptz columns. */
export function dayStartInstant(date: string): string {
  return `${date}T00:00:00+08:00`;
}

export function monthStartInstant(month: string): string {
  return dayStartInstant(`${month}-01`);
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// ---------------------------------------------------------------------------
// Pay periods
// ---------------------------------------------------------------------------

export type Period = { start: string; end: string; days: number; /** periods per month */ perMonth: number };

/** Payday `day` in `month`, clamped: 31 means the last day, 30 in February means the 28th or 29th. */
function paydayIn(month: string, day: number): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;
}

/**
 * The budget period containing `today`: from the latest payday on or before it to the day before the next.
 * Paydays {1} give calendar months; {15, 31} give the 15th to the day before month-end, then month-end to the 14th.
 */
export function payPeriod(today: string, paydays: number[]): Period {
  const days = [...new Set(paydays)].filter((d) => d >= 1 && d <= 31);
  const list = days.length ? days : [1];
  const month = monthOf(today);
  const candidates = [-1, 0, 1]
    .flatMap((n) => list.map((d) => paydayIn(addMonths(month, n), d)))
    .sort();
  const unique = [...new Set(candidates)];
  const start = unique.filter((d) => d <= today).at(-1)!;
  const next = unique.find((d) => d > today)!;
  const end = addDays(next, -1);
  return { start, end, days: daysBetween(start, end) + 1, perMonth: list.length };
}

/** "Oct 15 to 30" or "Oct 31 to Nov 14". */
export function describePeriod(p: Period): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-PH", { ...(withMonth ? { month: "short" } : {}), day: "numeric", timeZone: "UTC" }).format(
      new Date(`${d}T00:00:00Z`),
    );
  return `${fmt(p.start, true)} to ${fmt(p.end, monthOf(p.start) !== monthOf(p.end))}`;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export type CategoryTotal = { id: string; name: string; total: Centavos; fixed: boolean };
export type MerchantTotal = { name: string; total: Centavos; count: number };

export type MonthSpending = {
  month: string;
  /** All spending, fixed bills included. */
  spent: Centavos;
  /** The part in categories marked fixed (rent, bills): planned for, so not in the daily amount. */
  fixedSpent: Centavos;
  income: Centavos;
  /** Everyday (not fixed) spending per day of the month, index 0 = the 1st. */
  daily: Centavos[];
  categories: CategoryTotal[];
  merchants: MerchantTotal[];
  /** Money out still in To review: not in the totals yet (it may turn out to be a transfer or a duplicate). */
  pendingCount: number;
  pendingOut: Centavos;
};

const UNCATEGORIZED = { id: "none", name: "Uncategorized" };

/** Totals count confirmed transactions only; what's still to review is reported beside them. */
export function summarizeMonth(month: string, txns: SpendingTxn[], fixed: ReadonlySet<string> = new Set()): MonthSpending {
  const daily: Centavos[] = Array.from({ length: daysInMonth(month) }, () => 0);
  const categories = new Map<string, CategoryTotal>();
  const merchants = new Map<string, MerchantTotal>();
  let spent = 0;
  let fixedSpent = 0;
  let income = 0;
  let pendingCount = 0;
  let pendingOut = 0;

  for (const t of txns) {
    const day = todayInManila(new Date(t.occurredAt));
    if (monthOf(day) !== month) continue;
    const c = classify(t);
    if (!c) continue;
    if (t.pending) {
      if (c.kind === "spend" && c.amount > 0) {
        pendingCount++;
        pendingOut += c.amount;
      }
      continue;
    }
    if (c.kind === "income") {
      income += c.amount;
      continue;
    }
    const cat = t.category ?? UNCATEGORIZED;
    const isFixed = fixed.has(cat.id);
    spent += c.amount;
    if (isFixed) fixedSpent += c.amount;
    else daily[Number(day.slice(8, 10)) - 1] += c.amount;
    const entry = categories.get(cat.id) ?? { id: cat.id, name: cat.name, total: 0, fixed: isFixed };
    entry.total += c.amount;
    categories.set(cat.id, entry);
    const name = t.merchant?.trim();
    if (name) {
      const key = name.toLowerCase();
      const m = merchants.get(key) ?? { name, total: 0, count: 0 };
      m.total += c.amount;
      m.count++;
      merchants.set(key, m);
    }
  }

  const byTotal = <T extends { total: number }>(a: T, b: T) => b.total - a.total;
  return {
    month,
    spent,
    fixedSpent,
    income,
    daily,
    categories: [...categories.values()].filter((c) => c.total > 0).sort(byTotal),
    merchants: [...merchants.values()].filter((m) => m.total > 0).sort(byTotal),
    pendingCount,
    pendingOut,
  };
}

/**
 * Everyday spending per day from `start` to `end` (inclusive), index 0 = `start`. Fixed categories are left out.
 * With `includePending`, money out still to review counts too (used for alerts, where waiting would be too late).
 */
export function everydayByDate(
  txns: SpendingTxn[],
  start: string,
  end: string,
  fixed: ReadonlySet<string>,
  { includePending = false } = {},
): Centavos[] {
  const out: Centavos[] = Array.from({ length: daysBetween(start, end) + 1 }, () => 0);
  for (const t of txns) {
    if (t.pending && !includePending) continue;
    const day = todayInManila(new Date(t.occurredAt));
    if (day < start || day > end) continue;
    const c = classify(t);
    if (!c || c.kind !== "spend") continue;
    if (t.pending && c.amount < 0) continue;
    if (fixed.has(t.category?.id ?? UNCATEGORIZED.id)) continue;
    out[daysBetween(start, day)] += c.amount;
  }
  return out;
}

/** Running total per day: index i is everything spent from the 1st through day i + 1. */
export function cumulative(daily: Centavos[]): Centavos[] {
  let sum = 0;
  return daily.map((d) => (sum += d));
}

/** Spent by the same day of the month (clamped to that month's length), e.g. by Sep 30 when today is Oct 31. */
export function spentByDay(daily: Centavos[], day: number): Centavos {
  return daily.slice(0, Math.min(day, daily.length)).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Daily amount
// ---------------------------------------------------------------------------

export type Allowance = {
  budget: Centavos;
  /** Can still be spent today; negative means over today's share. */
  leftToday: Centavos;
  /** Today's share: what's left of the period before today, split evenly over the days remaining. */
  todayShare: Centavos;
  leftForPeriod: Centavos;
  /** Even split of the budget: the "normal" daily amount. */
  perDay: Centavos;
  /** What each day after today can take if the rest is spread evenly. */
  perDayAfterToday: Centavos;
  daysLeft: number;
  /** Expected spending by end of today at an even pace. */
  paceTarget: Centavos;
};

/**
 * The daily amount for a period. `daily` has one entry per day of the period; `dayIndex` is today (0 = first day).
 * Overspending shrinks the days after it, underspending grows them, so the period still lands on the budget.
 * Integer centavos throughout; shares round down so they never add up to more.
 */
export function allowance(budget: Centavos, daily: Centavos[], dayIndex: number): Allowance {
  const spentBefore = spentByDay(daily, dayIndex);
  const spentToday = daily[dayIndex] ?? 0;
  const daysLeft = daily.length - dayIndex;
  const remainingBefore = budget - spentBefore;
  const todayShare = Math.floor(Math.max(0, remainingBefore) / daysLeft);
  const leftForPeriod = remainingBefore - spentToday;
  return {
    budget,
    leftToday: todayShare - spentToday,
    todayShare,
    leftForPeriod,
    perDay: Math.floor(budget / daily.length),
    perDayAfterToday: daysLeft > 1 ? Math.floor(Math.max(0, leftForPeriod) / (daysLeft - 1)) : 0,
    daysLeft,
    paceTarget: Math.floor((budget * (dayIndex + 1)) / daily.length),
  };
}

/** The monthly limit shared evenly across the month's pay periods. */
export function periodBudget(monthlyLimit: Centavos, period: Period): Centavos {
  return Math.floor(monthlyLimit / period.perMonth);
}

// ---------------------------------------------------------------------------
// Category limits
// ---------------------------------------------------------------------------

export type CategorySetting = { fixed: boolean; limit: Centavos | null };

export type LimitStatus = { id: string; name: string; spent: Centavos; limit: Centavos; state: "ok" | "near" | "over" };

/** Each category with a limit and how close this month's spending is. "near" from 80%. */
export function limitStatuses(
  month: MonthSpending,
  settings: ReadonlyMap<string, CategorySetting>,
  names: ReadonlyMap<string, string>,
): LimitStatus[] {
  const spentBy = new Map(month.categories.map((c) => [c.id, c.total]));
  const out: LimitStatus[] = [];
  for (const [id, s] of settings) {
    if (!s.limit) continue;
    const spent = spentBy.get(id) ?? 0;
    const state = spent > s.limit ? "over" : spent * 10 >= s.limit * 8 ? "near" : "ok";
    out.push({ id, name: names.get(id) ?? "Category", spent, limit: s.limit, state });
  }
  const rank = { over: 0, near: 1, ok: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || b.spent / b.limit - a.spent / a.limit);
}

/**
 * What fixed bills will likely take this month: each fixed category's limit when set, otherwise what it took
 * last month or this month so far, whichever is larger (a bill paid early still counts).
 */
export function expectedFixed(settings: ReadonlyMap<string, CategorySetting>, lastMonth: MonthSpending, thisMonth?: MonthSpending): Centavos {
  const last = new Map(lastMonth.categories.map((c) => [c.id, c.total]));
  const now = new Map((thisMonth?.categories ?? []).map((c) => [c.id, c.total]));
  let total = 0;
  for (const [id, s] of settings) if (s.fixed) total += s.limit ?? Math.max(last.get(id) ?? 0, now.get(id) ?? 0);
  return total;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalPlan = {
  remaining: Centavos;
  /** Set when the goal has a date still ahead and isn't reached yet. */
  perMonth: Centavos | null;
  perDay: Centavos | null;
  monthsLeft: number | null;
  reached: boolean;
  late: boolean;
};

/** How much to put aside to reach a goal by its date. Rounds up so following the plan always gets there. */
export function goalPlan(goal: { target: Centavos; saved: Centavos; targetDate: string | null }, today: string): GoalPlan {
  const remaining = Math.max(0, goal.target - goal.saved);
  const reached = remaining === 0;
  if (reached || !goal.targetDate) return { remaining, perMonth: null, perDay: null, monthsLeft: null, reached, late: false };
  const days = daysBetween(today, goal.targetDate);
  if (days < 0) return { remaining, perMonth: null, perDay: null, monthsLeft: null, reached, late: true };
  const [ty, tm] = goal.targetDate.split("-").map(Number);
  const [y, m] = today.split("-").map(Number);
  // Months left, counting this one: Oct 31 from Oct 12 is one month, Nov 5 is two.
  const monthsLeft = Math.max(1, ty * 12 + tm - (y * 12 + m) + 1);
  return {
    remaining,
    perMonth: Math.ceil(remaining / monthsLeft),
    perDay: Math.ceil(remaining / (days + 1)),
    monthsLeft,
    reached,
    late: false,
  };
}

// ---------------------------------------------------------------------------
// Safe to spend until payday
// ---------------------------------------------------------------------------

export type SafeToSpend = {
  cash: Centavos;
  earmarked: Centavos;
  dues: Centavos;
  safe: Centavos;
  perDay: Centavos;
  daysToPayday: number;
};

/**
 * Cash on hand, minus money already set aside for goals, minus what's due before the next payday.
 * Days counts today through the day before payday.
 */
export function safeToSpend(input: { cash: Centavos; earmarked: Centavos; dues: Centavos; today: string; period: Period }): SafeToSpend {
  const safe = input.cash - input.earmarked - input.dues;
  const daysToPayday = daysBetween(input.today, input.period.end) + 1;
  return { ...input, safe, daysToPayday, perDay: safe > 0 ? Math.floor(safe / daysToPayday) : 0 };
}

// ---------------------------------------------------------------------------
// Repeat charges (subscriptions)
// ---------------------------------------------------------------------------

export type RepeatCharge = { merchant: string; amount: Centavos; last: string; next: string; times: number; categoryId: string | null };

const merchantKey = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, " ").trim();

/**
 * Charges that look like subscriptions: the same place, about the same amount (within 10%), roughly once a
 * month (24 to 38 days apart) at least twice in a row. Daily coffee and one-offs don't qualify.
 */
export function findRepeatCharges(txns: SpendingTxn[], today: string): RepeatCharge[] {
  const groups = new Map<string, { name: string; date: string; amount: Centavos; categoryId: string | null }[]>();
  for (const t of txns) {
    if (t.pending || !t.merchant) continue;
    const c = classify(t);
    if (!c || c.kind !== "spend" || c.amount <= 0) continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push({ name: t.merchant.trim(), date: todayInManila(new Date(t.occurredAt)), amount: c.amount, categoryId: t.category?.id ?? null });
    groups.set(key, list);
  }

  const found: RepeatCharge[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    // Walk back from the latest charge while each earlier one is ~a month before and ~the same amount.
    const latest = list.at(-1)!;
    const chain = [latest];
    for (let i = list.length - 2; i >= 0; i--) {
      const prev = list[i];
      const gap = daysBetween(prev.date, chain[0].date);
      if (gap < 24) continue;
      if (gap > 38) break;
      if (Math.abs(prev.amount - latest.amount) * 10 > latest.amount) continue;
      chain.unshift(prev);
    }
    if (chain.length < 2) continue;
    // Too many other charges at the same place between them: a regular haunt, not a subscription.
    if (list.length > chain.length * 2 + 1) continue;
    const gaps = chain.slice(1).map((c, i) => daysBetween(chain[i].date, c.date));
    const gap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const next = addDays(latest.date, gap);
    // Stale: it stopped (missed by more than a couple of weeks).
    if (daysBetween(next, today) > 14) continue;
    found.push({ merchant: latest.name, amount: latest.amount, last: latest.date, next, times: chain.length, categoryId: latest.categoryId });
  }
  return found.sort((a, b) => b.amount - a.amount);
}
