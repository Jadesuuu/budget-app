import { CircleAlert } from "lucide-react";
import type { DueItem } from "@/lib/data/due-items";
import { dayAndMonth, daysBetween, relativeDue } from "@/lib/dates";
import { formatPeso } from "@/lib/money";

export function DueList({ today, items }: { today: string; items: DueItem[] }) {
  if (items.length === 0) {
    return <p className="quiet-empty">Nothing due in the next 30 days.</p>;
  }
  return (
    <ul className="due-list">
      {items.map((item) => {
        const { day, month } = dayAndMonth(item.dueDate);
        const overdue = daysBetween(today, item.dueDate) < 0;
        return (
          <li key={item.key} className={overdue ? "due-row overdue" : "due-row"}>
            <div className="due-tile" aria-hidden>
              <span className="d">{day}</span>
              <span className="m">{month}</span>
            </div>
            <div>
              <p className="due-name">{item.name}</p>
              <p className="due-sub">{item.detail}</p>
            </div>
            <div className="due-amt">
              <p className="v">{formatPeso(item.amount)}</p>
              {overdue ? (
                <p className="overdue-tag">
                  <CircleAlert aria-hidden />
                  {relativeDue(today, item.dueDate)}
                </p>
              ) : (
                <p className="l">
                  {item.amountLabel}, {relativeDue(today, item.dueDate).toLowerCase()}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
