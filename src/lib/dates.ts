// Calendar dates are "YYYY-MM-DD" strings in Asia/Manila; instants stay timestamptz/Date.

export const APP_TIME_ZONE = "Asia/Manila";

/** Today's calendar date in Manila, as YYYY-MM-DD. */
export function todayInManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function monthName(date: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** "18" and "Oct" for a due-date tile. */
export function dayAndMonth(date: string): { day: string; month: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(d),
  };
}

/** "Due today", "Tomorrow", "In 7 days", "1 day late". */
export function relativeDue(today: string, due: string): string {
  const days = daysBetween(today, due);
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return days === -1 ? "1 day late" : `${-days} days late`;
}
