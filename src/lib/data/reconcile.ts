import "server-only";
import { getSession } from "@/lib/auth";

export type BalanceCheck = {
  accountId: string;
  /** What the bank said, in the app's sign. */
  reportedCentavos: number;
  confirmedCentavos: number;
  pendingCentavos: number;
  /** reported - (confirmed + pending): what Budget is missing (negative = Budget has too much). */
  gapCentavos: number;
  asOf: string;
  source: string;
  state: "matched" | "after_review" | "off";
};

export function toCheck(row: {
  account_id: string | null;
  reported_centavos: number | null;
  confirmed_centavos: number | null;
  pending_centavos: number | null;
  as_of: string | null;
  source: string | null;
}): BalanceCheck | null {
  if (!row.account_id || row.reported_centavos === null || !row.as_of) return null;
  const confirmed = row.confirmed_centavos ?? 0;
  const pending = row.pending_centavos ?? 0;
  const gap = row.reported_centavos - confirmed - pending;
  return {
    accountId: row.account_id,
    reportedCentavos: row.reported_centavos,
    confirmedCentavos: confirmed,
    pendingCentavos: pending,
    gapCentavos: gap,
    asOf: row.as_of,
    source: row.source ?? "manual",
    state: gap !== 0 ? "off" : pending !== 0 ? "after_review" : "matched",
  };
}

/** Latest balance check per account. */
export async function getBalanceChecks(): Promise<Map<string, BalanceCheck>> {
  const { supabase } = await getSession();
  const { data, error } = await supabase
    .from("account_reconciliation")
    .select("account_id, reported_centavos, confirmed_centavos, pending_centavos, as_of, source");
  if (error) throw error;
  const checks = new Map<string, BalanceCheck>();
  for (const row of data) {
    const check = toCheck(row);
    if (check) checks.set(check.accountId, check);
  }
  return checks;
}
