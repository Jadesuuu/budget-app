/** One row from a bank history or statement file. Amounts use the app's sign (money out is negative). */
export type ImportRow = {
  occurredAt: string;
  amountCentavos: number;
  description: string;
  /** Running balance after this row, when the file shows one. */
  balanceAfterCentavos?: number | null;
};

export type ExistingTransaction = {
  id: string;
  occurredAt: string;
  amountCentavos: number;
  merchant: string | null;
  status: "pending" | "confirmed";
};

export type ImportMatch = {
  matched: { row: ImportRow; existingId: string }[];
  /** Rows Budget doesn't have yet: these get added. */
  missing: ImportRow[];
  /** Budget transactions inside the file's date range that the file doesn't list: worth a look. */
  notInFile: ExistingTransaction[];
};

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Lines up a bank file with what Budget already has. Same amount and within 2 days counts as the same
 * transaction; each side is used at most once, closest in time first. Budget's captured time and the
 * bank's posting time often differ by hours or a day, hence the window.
 */
export function matchImport(rows: ImportRow[], existing: ExistingTransaction[]): ImportMatch {
  const pairs: { rowIndex: number; existingId: string; gap: number }[] = [];
  rows.forEach((row, rowIndex) => {
    const rowTime = Date.parse(row.occurredAt);
    for (const tx of existing) {
      if (tx.amountCentavos !== row.amountCentavos) continue;
      const gap = Math.abs(Date.parse(tx.occurredAt) - rowTime);
      if (gap <= WINDOW_MS) pairs.push({ rowIndex, existingId: tx.id, gap });
    }
  });
  pairs.sort((a, b) => a.gap - b.gap);

  const usedRows = new Set<number>();
  const usedExisting = new Set<string>();
  const matched: ImportMatch["matched"] = [];
  for (const pair of pairs) {
    if (usedRows.has(pair.rowIndex) || usedExisting.has(pair.existingId)) continue;
    usedRows.add(pair.rowIndex);
    usedExisting.add(pair.existingId);
    matched.push({ row: rows[pair.rowIndex], existingId: pair.existingId });
  }

  const times = rows.map((r) => Date.parse(r.occurredAt));
  const [from, to] = times.length ? [Math.min(...times), Math.max(...times)] : [0, -1];
  return {
    matched,
    missing: rows.filter((_, i) => !usedRows.has(i)),
    notInFile: existing.filter((tx) => {
      const t = Date.parse(tx.occurredAt);
      return !usedExisting.has(tx.id) && t >= from && t <= to;
    }),
  };
}

/** The last running balance in the file, as a checkpoint at the last row's time. */
export function closingBalance(rows: ImportRow[]): { balanceCentavos: number; asOf: string } | null {
  const withBalance = rows.filter((r) => r.balanceAfterCentavos !== null && r.balanceAfterCentavos !== undefined);
  if (withBalance.length === 0) return null;
  const last = withBalance.reduce((a, b) => (Date.parse(b.occurredAt) >= Date.parse(a.occurredAt) ? b : a));
  return { balanceCentavos: last.balanceAfterCentavos!, asOf: last.occurredAt };
}
