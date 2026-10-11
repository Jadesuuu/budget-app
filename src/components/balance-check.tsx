import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { BalanceCheck } from "@/lib/data/reconcile";
import { describeWhen } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";

/** One-line status: does Budget agree with the bank's last stated balance? */
export function BalanceCheckChip({ check, bank }: { check: BalanceCheck | undefined; bank: string }) {
  if (!check) return null;
  if (check.state === "matched") {
    return (
      <span className="check-chip ok">
        <CircleCheck aria-hidden />
        Matches {bank}
      </span>
    );
  }
  if (check.state === "after_review") {
    return (
      <span className="check-chip muted">
        <Clock aria-hidden />
        Matches {bank} once you review
      </span>
    );
  }
  return (
    <span className="check-chip warn">
      <CircleAlert aria-hidden />
      {formatPeso(Math.abs(check.gapCentavos))} unaccounted
    </span>
  );
}

/** Longer explanation for the account page. */
export function describeCheck(check: BalanceCheck, bank: string, owed: boolean): string {
  const show = (c: number) => formatPeso(owed ? -c : c);
  const when = describeWhen(check.asOf);
  const said = `${bank} said ${owed ? "you owed" : "the balance was"} ${show(check.reportedCentavos)} (${when})`;
  if (check.state === "matched") return `${said}. Budget agrees.`;
  const budget = check.confirmedCentavos + check.pendingCentavos;
  if (check.state === "after_review") return `${said}. Budget agrees once you review the waiting transactions.`;
  // Bank lower than Budget (gap < 0) means spending is missing, for cash and owed accounts alike.
  const gap = check.gapCentavos;
  const direction = gap < 0 ? `${formatPeso(-gap)} of spending isn't in Budget yet` : `${formatPeso(gap)} of money in isn't in Budget yet`;
  return `${said}, but Budget has ${show(budget)}. About ${direction}, or something was recorded twice.`;
}
