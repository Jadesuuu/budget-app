import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getProfile, getSession } from "@/lib/auth";
import { daysBetween, todayInManila } from "@/lib/dates";
import {
  addMonths,
  allowance,
  everydayByDate,
  limitStatuses,
  monthOf,
  monthStartInstant,
  payPeriod,
  periodBudget,
  safeToSpend,
  summarizeMonth,
  type CategorySetting,
  type MonthSpending,
  type SpendingTxn,
} from "@/lib/spending";
import { OWED_TYPES } from "./accounts";
import { getDueSoon } from "./due";

const PAGE = 1000; // PostgREST's default row cap per request
const CASH_TYPES = new Set(["ewallet", "savings", "debit"]);

/**
 * Transactions that count toward spending and income from the start of `fromMonth` to the end of `toMonth`.
 * Includes ones still to review (shown beside the totals) but not suspected duplicates, ignored ones,
 * or transfers between the user's own accounts.
 */
export async function getSpendingTxns(fromMonth: string, toMonth: string): Promise<SpendingTxn[]> {
  const { supabase } = await getSession();
  return loadSpendingTxns(supabase, fromMonth, toMonth);
}

/** Same, with any client: background jobs pass the admin client and must pass a userId. */
export async function loadSpendingTxns(
  supabase: SupabaseClient<Database>,
  fromMonth: string,
  toMonth: string,
  userId?: string,
): Promise<SpendingTxn[]> {
  const rows: SpendingTxn[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("transactions")
      .select("amount_centavos, occurred_at, merchant, status, categories(id, name, kind), accounts(type)")
      .in("status", ["confirmed", "pending"])
      .is("transfer_id", null)
      .is("duplicate_of", null)
      .gte("occurred_at", monthStartInstant(fromMonth))
      .lt("occurred_at", monthStartInstant(addMonths(toMonth, 1)))
      .order("occurred_at")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    for (const t of data) {
      rows.push({
        amount: t.amount_centavos,
        occurredAt: t.occurred_at,
        merchant: t.merchant,
        category: t.categories,
        owedAccount: OWED_TYPES.has(t.accounts?.type ?? ""),
        pending: t.status === "pending",
      });
    }
    if (data.length < PAGE) return rows;
  }
}

export async function getSpendingPlan() {
  const profile = await getProfile();
  return {
    income: profile.monthly_income_centavos,
    limit: profile.spending_limit_centavos,
    paydays: profile.paydays,
  };
}

export type CategoryInfo = { id: string; name: string; kind: string; fixed: boolean; limit: number | null };

/** Every category the user can use, with their fixed flag and monthly limit. */
export async function getCategories(): Promise<CategoryInfo[]> {
  const { supabase } = await getSession();
  const [categories, settings] = await Promise.all([
    supabase.from("categories").select("id, name, kind").order("name"),
    supabase.from("category_settings").select("category_id, fixed, monthly_limit_centavos"),
  ]);
  if (categories.error) throw categories.error;
  if (settings.error) throw settings.error;
  const byId = new Map(settings.data.map((s) => [s.category_id, s]));
  return categories.data.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    fixed: byId.get(c.id)?.fixed ?? false,
    limit: byId.get(c.id)?.monthly_limit_centavos ?? null,
  }));
}

export function settingsMap(categories: CategoryInfo[]): Map<string, CategorySetting> {
  return new Map(categories.filter((c) => c.fixed || c.limit).map((c) => [c.id, { fixed: c.fixed, limit: c.limit }]));
}

export function fixedSet(categories: CategoryInfo[]): Set<string> {
  return new Set(categories.filter((c) => c.fixed).map((c) => c.id));
}

/** The month and the `history - 1` months before it, oldest first. */
export async function getSpendingHistory(
  month: string,
  history: number,
  fixed: ReadonlySet<string>,
): Promise<{ months: MonthSpending[]; txns: SpendingTxn[] }> {
  const first = addMonths(month, -(history - 1));
  const txns = await getSpendingTxns(first, month);
  return { months: Array.from({ length: history }, (_, i) => summarizeMonth(addMonths(first, i), txns, fixed)), txns };
}

export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate: string | null;
  account: { id: string; name: string } | null;
};

/** Goals backed by an account take that account's balance as what's saved (never below zero). */
export async function getGoals(): Promise<Goal[]> {
  const { supabase } = await getSession();
  const [goals, balances] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("id, name, target_centavos, saved_centavos, target_date, account_id, accounts(name)")
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("account_balances").select("account_id, balance_centavos"),
  ]);
  if (goals.error) throw goals.error;
  if (balances.error) throw balances.error;
  const balance = new Map(balances.data.map((b) => [b.account_id, b.balance_centavos ?? 0]));
  return goals.data.map((g) => ({
    id: g.id,
    name: g.name,
    target: g.target_centavos,
    saved: g.account_id ? Math.max(0, balance.get(g.account_id) ?? 0) : g.saved_centavos,
    targetDate: g.target_date,
    account: g.account_id ? { id: g.account_id, name: g.accounts?.name ?? "Account" } : null,
  }));
}

/** Cash in e-wallets, savings and debit accounts that aren't set aside for a goal. */
async function getCashOnHand(goalAccounts: ReadonlySet<string>) {
  const { supabase } = await getSession();
  const [accounts, balances] = await Promise.all([
    supabase.from("accounts").select("id, type").is("archived_at", null),
    supabase.from("account_balances").select("account_id, balance_centavos"),
  ]);
  if (accounts.error) throw accounts.error;
  if (balances.error) throw balances.error;
  const balance = new Map(balances.data.map((b) => [b.account_id, b.balance_centavos ?? 0]));
  return accounts.data
    .filter((a) => CASH_TYPES.has(a.type) && !goalAccounts.has(a.id))
    .reduce((sum, a) => sum + (balance.get(a.id) ?? 0), 0);
}

/**
 * Everything the daily amount needs for today: the pay period, everyday spending in it, this month's
 * totals and category limits, and what's safe to spend until payday.
 */
export async function getBudgetToday() {
  const today = todayInManila();
  const month = monthOf(today);
  const [plan, categories, goals, due] = await Promise.all([getSpendingPlan(), getCategories(), getGoals(), getDueSoon()]);
  const period = payPeriod(today, plan.paydays);
  const fixed = fixedSet(categories);
  const txns = await getSpendingTxns(monthOf(period.start) < month ? monthOf(period.start) : month, month);
  const thisMonth = summarizeMonth(month, txns, fixed);
  const daily = everydayByDate(txns, period.start, period.end, fixed);
  const dayIndex = daysBetween(period.start, today);
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const goalAccounts = new Set(goals.flatMap((g) => (g.account ? [g.account.id] : [])));
  const cash = await getCashOnHand(goalAccounts);
  const earmarked = goals.filter((g) => !g.account).reduce((s, g) => s + g.saved, 0);
  const duesBefore = due.items.filter((d) => d.dueDate <= period.end);
  const dues = duesBefore.reduce((s, d) => s + d.fullAmount, 0);

  return {
    today,
    plan,
    period,
    daily,
    dayIndex,
    duesBeforeList: duesBefore,
    thisMonth,
    allowance: plan.limit !== null ? allowance(periodBudget(plan.limit, period), daily, dayIndex) : null,
    limits: limitStatuses(thisMonth, settingsMap(categories), names),
    safe: safeToSpend({ cash, earmarked, dues, today, period }),
    duesBeforePayday: duesBefore.length,
  };
}
