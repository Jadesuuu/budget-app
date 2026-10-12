import type { DueItem } from "@/lib/data/due-items";
import { daysBetween, relativeDue } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import type { Allowance, LimitStatus } from "@/lib/spending";

export type Alert = {
  kind: "bill" | "over-today" | "category";
  /** Unique per thing and moment, so each alert is sent once (see notification_log). */
  ref: string;
  title: string;
  body: string;
  url: string;
};

export type AlertInput = {
  today: string;
  /** Hour of the day in Manila, 0 to 23. */
  hour: number;
  prefs: { bills: boolean; spending: boolean };
  due: DueItem[];
  /** Today's daily amount, counting money out still to review (waiting for review would be too late). */
  allowance: Allowance | null;
  limits: LimitStatus[];
};

/** Bills are announced 3 days and 1 day before, on the day, and the day after if still unpaid. */
const BILL_DAYS = new Set([3, 1, 0, -1]);
/** No alerts at night; anything held back goes out on the first run in the morning. */
export const QUIET_BEFORE = 8;
export const QUIET_FROM = 22;

export function computeAlerts(input: AlertInput): Alert[] {
  if (input.hour < QUIET_BEFORE || input.hour >= QUIET_FROM) return [];
  const alerts: Alert[] = [];
  const month = input.today.slice(0, 7);

  if (input.prefs.bills) {
    for (const item of input.due) {
      if (item.minimumMet) continue;
      const days = daysBetween(input.today, item.dueDate);
      if (!BILL_DAYS.has(days)) continue;
      const when = relativeDue(input.today, item.dueDate);
      alerts.push({
        kind: "bill",
        ref: `${item.key}:${days}`,
        title: days < 0 ? `${item.name} is late` : `${item.name}: ${when === "Tomorrow" ? "due tomorrow" : when.toLowerCase()}`,
        body: `${item.amountLabel} ${formatPeso(item.amount)}${item.fullAmount > item.amount ? `, ${formatPeso(item.fullAmount)} to pay in full` : ""}.`,
        url: "/",
      });
    }
  }

  if (input.prefs.spending) {
    const a = input.allowance;
    if (a && a.leftToday < 0) {
      alerts.push({
        kind: "over-today",
        ref: input.today,
        title: `${formatPeso(-a.leftToday)} over today's amount`,
        body:
          a.leftForPeriod > 0 && a.daysLeft > 1
            ? `The days after today now get about ${formatPeso(a.perDayAfterToday)} each.`
            : "You've used this period's spending limit.",
        url: "/spending",
      });
    }
    for (const l of input.limits) {
      if (l.state === "ok") continue;
      alerts.push({
        kind: "category",
        ref: `${l.state}:${l.id}:${month}`,
        title: l.state === "over" ? `${l.name} is over its limit` : `${l.name} is at ${Math.floor((l.spent / l.limit) * 100)}% of its limit`,
        body: `${formatPeso(l.spent)} of ${formatPeso(l.limit)} this month.`,
        url: "/spending",
      });
    }
  }
  return alerts;
}
