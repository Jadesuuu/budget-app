// Shared helpers for bank email and SMS templates. All times printed by PH banks are Manila time (UTC+8).

import { parsePesoInput } from "@/lib/money-input";

/** "P1,018.00", "PHP 22,170.00", "Php4,044.18", "₱13885.00", "1000.00" -> centavos, or null. */
export function pesoAmount(text: string): number | null {
  const cleaned = text.trim().replace(/^(?:php|p|₱)\s*/i, "");
  return parsePesoInput(cleaned);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number, hour = 12, minute = 0, second = 0): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:${p(second)}+08:00`;
}

function to24(hour: number, ampm: string | undefined): number {
  if (!ampm) return hour;
  const pm = ampm.toUpperCase() === "PM";
  return hour === 12 ? (pm ? 12 : 0) : pm ? hour + 12 : hour;
}

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?`;

/**
 * Reads the date/time formats seen in PH bank messages, all as Manila time:
 *   "10-09-26 11:30:30 AM" / "10-07-26 10:06PM"      (GCash SMS, MM-DD-YY)
 *   "06 October 2026, 10:56:31PM"                     (GCash email)
 *   "Sep 14 2026; 07:53:04 PM (GMT +8)"              (BPI SMS)
 *   "Wednesday, Dec 17 2025; 04:05:59 AM(GMT + 8)"   (BPI email)
 * Returns an ISO string with +08:00, or null.
 */
export function manilaDateTime(text: string): string | null {
  let m = new RegExp(String.raw`\b(\d{2})-(\d{2})-(\d{2})\s+${TIME}`, "i").exec(text);
  if (m) return iso(2000 + Number(m[3]), Number(m[1]), Number(m[2]), to24(Number(m[4]), m[7]), Number(m[5]), Number(m[6] ?? 0));

  m = new RegExp(String.raw`\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s+${TIME}`, "i").exec(text);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    return iso(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]), to24(Number(m[4]), m[7]), Number(m[5]), Number(m[6] ?? 0));
  }

  m = new RegExp(String.raw`\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})[;,]?\s+${TIME}`, "i").exec(text);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    return iso(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]), to24(Number(m[4]), m[7]), Number(m[5]), Number(m[6] ?? 0));
  }
  return null;
}

/** "Aug 20, 2026" -> "2026-08-20", or null. */
export function monthDayYear(text: string): string | null {
  const m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
  const month = m ? MONTHS[m[1].slice(0, 3).toLowerCase()] : undefined;
  if (!m || !month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
