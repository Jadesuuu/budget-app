import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { BalanceCheck } from "@/lib/data/reconcile";
import { describeWhen } from "@/lib/inbox";
import type { ReactNode } from "react";
import { formatPeso } from "@/lib/money";
import { Private } from "./private-amount";

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
      <Private>{formatPeso(Math.abs(check.gapCentavos))}</Private> unaccounted
    </span>
  );
}

/** Longer explanation for the account page. */
export function describeCheck(check: BalanceCheck, bank: string, owed: boolean): ReactNode {
  const amount = (c: number) => <Private>{formatPeso(c)}</Private>;
  const show = (c: number) => amount(owed ? -c : c);
  const said = (
    <>
      {bank} said {owed ? "you owed" : "the balance was"} {show(check.reportedCentavos)} ({describeWhen(check.asOf)})
    </>
  );
  if (check.state === "matched") return <>{said}. Budget agrees.</>;
  if (check.state === "after_review") return <>{said}. Budget agrees once you review the waiting transactions.</>;
  const budget = check.confirmedCentavos + check.pendingCentavos;
  // Bank lower than Budget (gap < 0) means spending is missing, for cash and owed accounts alike.
  const gap = check.gapCentavos;
  const direction = gap < 0 ? <>{amount(-gap)} of spending isn&apos;t in Budget yet</> : <>{amount(gap)} of money in isn&apos;t in Budget yet</>;
  return (
    <>
      {said}, but Budget has {show(budget)}. About {direction}, or something was recorded twice.
    </>
  );
}
