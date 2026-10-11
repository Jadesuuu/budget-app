import { todayInManila } from "@/lib/dates";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** "10/21/2026" (MM/DD/YYYY, as PH banks print it) -> "2026-10-21". */
export function usDate(text: string): string | null {
  const m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text);
  if (!m) return null;
  const [month, day] = [Number(m[1]), Number(m[2])];
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${m[3]}-${pad(month)}-${pad(day)}` : null;
}

/** "SEP 27 2026" -> "2026-09-27". */
export function monthDayYearUpper(text: string): string | null {
  const m = /\b([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  const month = m ? MONTHS[m[1].toLowerCase()] : undefined;
  return m && month ? `${m[3]}-${pad(month)}-${pad(Number(m[2]))}` : null;
}

/**
 * "17 Sep" with no year (Atome bills): the year comes from when the email was sent, rolling forward
 * when the date would be more than ~6 months in the past (a December email about a January due date).
 */
export function dayMonthNoYear(text: string, sentAt: string): string | null {
  const m = /\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\b/.exec(text);
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  if (!m || !month) return null;
  const sent = todayInManila(new Date(sentAt));
  const [sentYear, sentMonth] = [Number(sent.slice(0, 4)), Number(sent.slice(5, 7))];
  const year = month < sentMonth - 6 ? sentYear + 1 : sentYear;
  return `${year}-${pad(month)}-${pad(Number(m[1]))}`;
}

/** "2026-08-27" as written in some reminders. */
export function isoDay(text: string): string | null {
  return /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)?.[1] ?? null;
}
