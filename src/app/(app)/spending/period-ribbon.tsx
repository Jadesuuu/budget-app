"use client";

import { useState } from "react";
import { addDays } from "@/lib/dates";
import { formatPeso } from "@/lib/money";

type Props = {
  /** First day of the pay period, YYYY-MM-DD. */
  start: string;
  /** Everyday spending per day of the period. */
  daily: number[];
  /** Index of today in `daily`. */
  todayIndex: number;
  /** The period's even split: budget / days. */
  evenShare: number;
  /** Today's amount (what's left before today, spread over the days left). */
  todayShare: number;
  /** What each day after today can take. */
  perDayAfter: number;
};

const weekday = (date: string) =>
  new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const dayNum = (date: string) => String(Number(date.slice(8, 10)));

/**
 * The pay period, payday to payday, one column per day: what each past day took, what today has left, and
 * what each day ahead can take. The dashed line is the even split, so overspending shows as height, not colour.
 */
export function PeriodRibbon({ start, daily, todayIndex, evenShare, todayShare, perDayAfter }: Props) {
  const [picked, setPicked] = useState(todayIndex);
  const max = Math.max(1, ...daily, todayShare, perDayAfter, evenShare) * 1.08;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const date = (i: number) => addDays(start, i);
  const labelled = (i: number) => i === 0 || i === todayIndex || i === daily.length - 1 || (i % 7 === 0 && Math.abs(i - todayIndex) > 1);

  const detail = (i: number) => {
    const d = weekday(date(i));
    if (i < todayIndex) {
      const diff = daily[i] - evenShare;
      return { title: d, text: `${formatPeso(daily[i])} spent`, sub: diff > 0 ? `${formatPeso(diff)} above an even day` : "Within an even day" };
    }
    if (i === todayIndex) {
      const left = todayShare - daily[i];
      return {
        title: `Today, ${d}`,
        text: `${formatPeso(daily[i])} spent of ${formatPeso(todayShare)}`,
        sub: left >= 0 ? `${formatPeso(left)} left` : `${formatPeso(-left)} over; the days after take it in`,
      };
    }
    return { title: d, text: `About ${formatPeso(perDayAfter)} to spend`, sub: "If the days before stay on plan" };
  };
  const shown = detail(picked);

  return (
    <figure className="ribbon">
      <div
        className="ribbon-days"
        style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Each day of this pay period. Pick a day to see its amounts; the table below has them all."
      >
        <span className="ribbon-even" style={{ bottom: pct(evenShare) }} aria-hidden />
        {daily.map((spent, i) => {
          const when = i < todayIndex ? "past" : i === todayIndex ? "today" : "ahead";
          return (
            <button
              key={i}
              type="button"
              className="ribbon-day"
              data-when={when}
              aria-pressed={picked === i}
              aria-label={`${detail(i).title}: ${detail(i).text}`}
              onClick={() => setPicked(i)}
            >
              <span className="ribbon-col">
                {when === "ahead" && <i className="cap" style={{ height: pct(perDayAfter) }} />}
                {when === "today" && <i className="cap" style={{ height: pct(Math.max(todayShare, spent)) }} />}
                {when !== "ahead" && spent > 0 && <i className="fill" style={{ height: pct(spent) }} />}
              </span>
              <span className="ribbon-label" aria-hidden>{labelled(i) ? (i === todayIndex ? "Today" : dayNum(date(i))) : ""}</span>
            </button>
          );
        })}
      </div>
      <figcaption className="ribbon-detail" aria-live="polite">
        <b>{shown.title}</b>
        <span>{shown.text}</span>
        <span className="hint">{shown.sub}</span>
      </figcaption>
      <details className="table-view">
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th scope="col">Day</th><th scope="col">Spent</th><th scope="col">Can take</th></tr></thead>
          <tbody>
            {daily.map((spent, i) => (
              <tr key={i}>
                <th scope="row">{i === todayIndex ? "Today" : weekday(date(i))}</th>
                <td>{i > todayIndex ? "–" : formatPeso(spent)}</td>
                <td>{i < todayIndex ? "–" : formatPeso(i === todayIndex ? todayShare : perDayAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
