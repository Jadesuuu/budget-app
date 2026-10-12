"use client";

import { useState, type PointerEvent } from "react";
import { formatPeso } from "@/lib/money";

type Props = {
  /** Running totals for the month shown, up to today when it's the current month. */
  current: number[];
  /** Running totals for the month before, full length. */
  previous: number[];
  daysInMonth: number;
  limit: number | null;
  monthShort: string;
  prevMonthShort: string;
};

const W = 340;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** "₱12k", "₱1.5k", "₱800" for axis ticks. Display only; values stay centavos. */
function short(centavos: number) {
  const pesos = centavos / 100;
  if (pesos >= 1000) return `₱${Number((pesos / 1000).toFixed(1))}k`;
  return `₱${Math.round(pesos)}`;
}

/** A round step so the y axis has 3 to 4 gridlines. */
function niceMax(value: number) {
  if (value <= 0) return 100000;
  const pesos = value / 100;
  const magnitude = 10 ** Math.floor(Math.log10(pesos));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * magnitude).find((s) => pesos / s <= 4) ?? 10 * magnitude;
  return Math.ceil(pesos / step) * step * 100;
}

/**
 * Cumulative spending this month against last month and an even pace to the limit. One y axis,
 * thin lines, direct labels at the line ends, and a crosshair with the day's figures on hover or tap.
 */
export function PaceChart({ current, previous, daysInMonth, limit, monthShort, prevMonthShort }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(limit ?? 0, ...current, ...previous));
  const x = (day: number) => PAD.left + ((day - 1) / Math.max(1, daysInMonth - 1)) * PLOT_W;
  const y = (v: number) => PAD.top + PLOT_H - (Math.max(0, v) / max) * PLOT_H;
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => max * f);
  const xTicks = [1, 8, 15, 22, daysInMonth];
  const prev = previous.slice(0, daysInMonth);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const day = Math.round(((px - PAD.left) / PLOT_W) * (daysInMonth - 1)) + 1;
    setHover(Math.min(daysInMonth, Math.max(1, day)));
  }

  const last = current.length;
  const hoverCur = hover !== null && hover <= last ? current[hover - 1] : null;
  const hoverPrev = hover !== null ? (prev[Math.min(hover, prev.length) - 1] ?? null) : null;
  const hoverPace = hover !== null && limit ? Math.floor((limit * hover) / daysInMonth) : null;

  return (
    <figure className="pace">
      <div className="pace-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Spending through ${monthShort}: ${formatPeso(current.at(-1) ?? 0)} so far, compared with ${prevMonthShort}${limit ? " and an even pace to your limit" : ""}. Table below.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{short(t)}</text>
            </g>
          ))}
          <line className="axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
          {xTicks.map((d) => (
            <text key={d} className="tick" x={x(d)} y={H - 6} textAnchor="middle">{d}</text>
          ))}
          {limit !== null && <line className="pace-line" x1={x(1)} y1={y(limit / daysInMonth)} x2={x(daysInMonth)} y2={y(limit)} />}
          {prev.length > 0 && <path className="prev-line" d={path(prev)} />}
          {last > 0 && <path className="cur-line" d={path(current)} />}
          {last > 0 && <circle className="cur-dot" cx={x(last)} cy={y(current[last - 1])} r={4} />}
          {hover !== null && (
            <g className="hover">
              <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} />
              {hoverPrev !== null && <circle className="prev-dot" cx={x(hover)} cy={y(hoverPrev)} r={4} />}
              {hoverCur !== null && <circle className="cur-dot" cx={x(hover)} cy={y(hoverCur)} r={4} />}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="pace-tip" style={{ left: `${(x(hover) / W) * 100}%` }} data-side={hover > daysInMonth / 2 ? "left" : "right"}>
            <p className="pace-tip-h">{monthShort} {hover}</p>
            {hoverCur !== null && <p><span className="key cur" />{formatPeso(hoverCur)} spent</p>}
            {hoverPrev !== null && <p><span className="key prev" />{formatPeso(hoverPrev)} by {prevMonthShort} {Math.min(hover, prev.length)}</p>}
            {hoverPace !== null && <p><span className="key pace-k" />{formatPeso(hoverPace)} even pace</p>}
          </div>
        )}
      </div>
      <figcaption className="pace-legend">
        <span><span className="key cur" />{monthShort}</span>
        <span><span className="key prev" />{prevMonthShort}</span>
        {limit !== null && <span><span className="key pace-k" />Even pace to your limit</span>}
      </figcaption>
    </figure>
  );
}
