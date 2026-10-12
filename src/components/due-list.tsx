"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { markDuePaid, undoDuePaid, type PaidResult } from "@/app/(app)/due-actions";
import type { DueItem } from "@/lib/data/due-items";
import { dayAndMonth, daysBetween, relativeDue } from "@/lib/dates";
import { formatPeso } from "@/lib/money";

type Toast = { message: string; undo?: Extract<PaidResult, { status: "saved" }>["undo"]; error?: boolean };

/**
 * Bills coming up. "Paid" saves at once and offers Undo, like confirming in Review. Card statements ask what
 * was paid (the minimum, the whole balance, or another amount); loans and installments are simply paid.
 */
export function DueList({ today, items, emptyText = "Nothing due in the next 30 days." }: { today: string; items: DueItem[]; emptyText?: string }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const [, start] = useTransition();

  const show = (t: Toast) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  };
  useEffect(() => {
    // The paid row is gone, so its button can't keep focus: hand it to Undo.
    if (toast?.undo) undoRef.current?.focus();
  }, [toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pay = (input: Parameters<typeof markDuePaid>[0]) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const result = await markDuePaid(input);
        if (result.status === "error") show({ message: result.message, error: true });
        else show({ message: result.message, undo: result.undo });
        resolve(result.status === "saved");
      }),
    );

  const undo = () => {
    const u = toast?.undo;
    if (!u) return;
    setToast(null);
    start(async () => {
      const result = await undoDuePaid(u);
      if (result.status === "error") show({ message: result.message, error: true });
    });
  };

  return (
    <>
      {items.length === 0 ? (
        <p className="quiet-empty">{emptyText}</p>
      ) : (
        <ul className="due-list">
          {items.map((item) => (
            <DueRow key={item.key} item={item} today={today} pay={pay} />
          ))}
        </ul>
      )}
      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite" data-error={toast?.error || undefined}>
        <span>{toast?.message}</span>
        {toast?.undo && <button ref={undoRef} type="button" onClick={undo}>Undo</button>}
      </div>
    </>
  );
}

function DueRow({ item, today, pay }: { item: DueItem; today: string; pay: (input: Parameters<typeof markDuePaid>[0]) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const { day, month } = dayAndMonth(item.dueDate);
  const overdue = !item.minimumMet && daysBetween(today, item.dueDate) < 0;
  const asks = item.kind === "statement";

  const commit = async (input: Parameters<typeof markDuePaid>[0]) => {
    setBusy(true);
    const ok = await pay(input);
    setBusy(false);
    if (ok) setOpen(false);
  };

  return (
    <li className={["due-row", overdue && "overdue", item.minimumMet && "settled", open && "open"].filter(Boolean).join(" ")}>
      <div className="due-tile" aria-hidden>
        <span className="d">{day}</span>
        <span className="m">{month}</span>
      </div>
      <div className="due-main">
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
      <button
        type="button"
        className="due-pay"
        aria-expanded={asks ? open : undefined}
        aria-label={asks ? `Paid ${item.name}…` : `Mark ${item.name} paid`}
        disabled={busy}
        onClick={() => (asks ? setOpen((v) => !v) : commit({ key: item.key }))}
      >
        {open ? <X aria-hidden /> : <Check aria-hidden />}
        <span>{open ? "Close" : "Paid"}</span>
      </button>

      {open && (
        <form
          className="due-choices"
          aria-label={`What you paid on ${item.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            commit({ key: item.key, pay: "other", amount: String(new FormData(e.currentTarget).get("amount") ?? "") });
          }}
        >
          {item.minimumLeft > 0 && (
            <button type="button" className="choice" disabled={busy} onClick={() => commit({ key: item.key, pay: "minimum" })}>
              <span>Minimum</span>
              <b>{formatPeso(item.minimumLeft)}</b>
            </button>
          )}
          <button type="button" className="choice" disabled={busy} onClick={() => commit({ key: item.key, pay: "full" })}>
            <span>In full</span>
            <b>{formatPeso(item.fullAmount)}</b>
          </button>
          {other ? (
            <span className="choice-other">
              <span className="peso-input">
                <span aria-hidden>₱</span>
                <input className="input" name="amount" inputMode="decimal" placeholder="0.00" autoComplete="off" aria-label="Amount paid" required autoFocus />
              </span>
              <button type="submit" className="btn primary" disabled={busy}>Save</button>
            </span>
          ) : (
            <button type="button" className="choice" onClick={() => setOther(true)}>
              <span>Other amount</span>
              <b aria-hidden>…</b>
            </button>
          )}
        </form>
      )}
    </li>
  );
}
