import Link from "next/link";
import { ChevronRight, CircleAlert } from "lucide-react";
import type { getBudgetToday } from "@/lib/data/spending";
import { formatPeso } from "@/lib/money";

type Budget = Awaited<ReturnType<typeof getBudgetToday>>;

/**
 * One line under the month: today's amount and what's left until payday. Review stays the hero below it;
 * anything that needs action (a short balance, a category over its limit) goes to "Needs a look".
 */
export function TodayStrip({ budget }: { budget: Budget }) {
  const a = budget.allowance;
  if (!a) {
    return (
      <Link href="/spending/plan" className="today-strip quiet">
        <span>Set your payday and get a daily amount</span>
        <ChevronRight aria-hidden />
      </Link>
    );
  }
  const over = a.leftToday < 0;
  return (
    <Link href="/spending" className="today-strip" data-over={over || undefined}>
      {over && <CircleAlert aria-hidden className="strip-alert" />}
      <span className="strip-main">
        <b className="num">{formatPeso(Math.abs(a.leftToday))}</b> {over ? "over today" : "left today"}
      </span>
      <span className="strip-rest">
        {a.leftForPeriod < 0
          ? `${formatPeso(-a.leftForPeriod)} over until payday`
          : `${formatPeso(a.leftForPeriod)} until payday`}
      </span>
      <ChevronRight aria-hidden className="strip-chev" />
    </Link>
  );
}
