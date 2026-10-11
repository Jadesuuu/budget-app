import { manilaDateTime } from "@/lib/parsing/values";
import { parsePesoInput } from "@/lib/money-input";
import type { ImportRow } from "@/lib/reconcile/match";

/** Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const HEADERS = {
  date: ["date", "transaction date", "date and time", "posting date", "posted date", "txn date"],
  description: ["description", "details", "particulars", "merchant", "transaction details", "remarks"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "withdrawal", "withdrawals", "money out", "debit amount"],
  credit: ["credit", "deposit", "deposits", "money in", "credit amount"],
  balance: ["balance", "running balance", "available balance", "ending balance"],
} as const;

/** Signed amount: "(1,234.50)", "-1,234.50" and "1,234.50 DR" are money out. */
function signedAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-") || /\bDR\b/i.test(text);
  const value = parsePesoInput(text.replace(/[()\-]/g, "").replace(/\b(DR|CR)\b/gi, "").replace(/^(?:php|₱|p)\s*/i, "").trim());
  return value === null ? null : negative ? -value : value;
}

function rowDate(raw: string): string | null {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T12:00:00+08:00`;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) {
    const iso = text.replace(" ", "T");
    return /[+-]\d{2}:?\d{2}$|Z$/.test(iso) ? iso : `${iso.length === 16 ? `${iso}:00` : iso}+08:00`;
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/.exec(text);
  if (us) {
    const day = `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    const time = us[4] ? /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i.exec(us[4]) : null;
    if (!time) return `${day}T12:00:00+08:00`;
    let hour = Number(time[1]);
    if (time[4]) hour = (hour % 12) + (time[4].toUpperCase() === "PM" ? 12 : 0);
    return `${day}T${String(hour).padStart(2, "0")}:${time[2]}:${time[3] ?? "00"}+08:00`;
  }
  return manilaDateTime(text) ?? (/^[A-Za-z]{3}/.test(text) && !Number.isNaN(Date.parse(`${text} 12:00 GMT+0800`)) ? new Date(Date.parse(`${text} 12:00 GMT+0800`)).toISOString() : null);
}

export type CsvResult = { rows: ImportRow[]; skipped: number } | { error: string };

/** Reads a bank CSV export by recognising its column headers (Date, Description, Debit/Credit or Amount, Balance). */
export function readBankCsv(text: string): CsvResult {
  const table = parseCsv(text);
  const headerIndex = table.findIndex((r) => r.some((c) => HEADERS.date.includes(c.trim().toLowerCase() as never)));
  if (headerIndex < 0) return { error: "Couldn't find a Date column in this CSV." };
  const header = table[headerIndex].map((c) => c.trim().toLowerCase());
  const col = (names: readonly string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    date: col(HEADERS.date),
    description: col(HEADERS.description),
    amount: col(HEADERS.amount),
    debit: col(HEADERS.debit),
    credit: col(HEADERS.credit),
    balance: col(HEADERS.balance),
  };
  if (idx.amount < 0 && idx.debit < 0 && idx.credit < 0) return { error: "Couldn't find Amount or Debit/Credit columns in this CSV." };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of table.slice(headerIndex + 1)) {
    const occurredAt = rowDate(r[idx.date] ?? "");
    let amount: number | null = null;
    if (idx.amount >= 0) amount = signedAmount(r[idx.amount] ?? "");
    else {
      const debit = signedAmount(r[idx.debit] ?? "");
      const credit = signedAmount(r[idx.credit] ?? "");
      amount = debit ? -Math.abs(debit) : credit ? Math.abs(credit) : null;
    }
    if (!occurredAt || !amount) {
      skipped++;
      continue;
    }
    rows.push({
      occurredAt,
      amountCentavos: amount,
      description: (idx.description >= 0 ? r[idx.description] : "")?.trim() || "Imported transaction",
      balanceAfterCentavos: idx.balance >= 0 ? signedAmount(r[idx.balance] ?? "") : null,
    });
  }
  if (rows.length === 0) return { error: "No transactions found in this CSV." };
  return { rows, skipped };
}
