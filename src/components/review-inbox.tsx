"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Copy, Mail, Repeat, X } from "lucide-react";
import {
  confirmAsTransfer,
  confirmOneSidedTransfer,
  confirmTransaction,
  ignoreTransaction,
  markNotDuplicate,
  reopenTransaction,
  type ActionResult,
} from "@/app/(app)/review/actions";
import type { AccountOption, CategoryOption } from "@/lib/data/inbox";
import { badgeFor, describeSource, describeWhen, type InboxItem, type TransferPair } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";

type Toast = { message: string; undoIds: string[] | null; error?: boolean };

type Props = {
  items: InboxItem[];
  pairs: TransferPair[];
  categories: CategoryOption[];
  accounts: AccountOption[];
  variant: "home" | "page";
};

const SWIPE_THRESHOLD = 100;

export function ReviewInbox({ items, pairs, categories, accounts, variant }: Props) {
  const [queue, setQueue] = useState(items);
  const [pairList, setPairList] = useState(pairs);
  const [categoryChoice, setCategoryChoice] = useState<Record<string, string>>({});
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [transferPickerFor, setTransferPickerFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const front = queue[0];
  const frontPair = front ? pairList.find((p) => p.outId === front.id || p.inId === front.id) : undefined;

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  /** Optimistically removes items, runs the action, and puts them back if it fails. */
  const run = useCallback(
    (ids: string[], action: () => Promise<ActionResult>, success: Toast, direction: "left" | "right") => {
      const removed = queue.filter((t) => ids.includes(t.id));
      setExiting(direction);
      setTimeout(() => {
        setExiting(null);
        setQueue((q) => q.filter((t) => !ids.includes(t.id)));
        setPairList((p) => p.filter((pair) => !ids.includes(pair.outId) && !ids.includes(pair.inId)));
        setTransferPickerFor(null);
      }, 220);
      startTransition(async () => {
        const result = await action();
        if (result.ok) {
          showToast(success);
        } else {
          setQueue((q) => [...removed, ...q.filter((t) => !ids.includes(t.id))]);
          showToast({ message: result.message, undoIds: null, error: true });
        }
      });
    },
    [queue, showToast],
  );

  const confirm = useCallback(() => {
    if (!front) return;
    const categoryId = categoryChoice[front.id] ?? front.categoryId;
    if (document.documentElement.dataset.theme === "sakura") petals();
    run([front.id], () => confirmTransaction({ id: front.id, categoryId }), {
      message: `Confirmed ${front.merchant ?? "transaction"}`,
      undoIds: [front.id],
    }, "right");
  }, [front, categoryChoice, run]);

  const ignore = useCallback(() => {
    if (!front) return;
    run([front.id], () => ignoreTransaction({ id: front.id }), {
      message: `Ignored ${front.merchant ?? "transaction"}`,
      undoIds: [front.id],
    }, "left");
  }, [front, run]);

  const undo = useCallback(() => {
    const ids = toast?.undoIds;
    if (!ids) return;
    const restored = items.filter((t) => ids.includes(t.id));
    setToast(null);
    setQueue((q) => [...restored, ...q]);
    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => reopenTransaction({ id })));
      const failure = results.find((r) => !r.ok);
      if (failure && !failure.ok) {
        setQueue((q) => q.filter((t) => !ids.includes(t.id)));
        showToast({ message: failure.message, undoIds: null, error: true });
      }
    });
  }, [toast, items, showToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "c") confirm();
      else if (key === "i") ignore();
      else if (key === "u") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, ignore, undo]);

  if (!front) {
    return (
      <>
        <div className="empty">
          <h2>All caught up</h2>
          <p>When your bank and e-wallet emails arrive, each one shows up here for a quick check.</p>
        </div>
        <ToastBar toast={toast} onUndo={undo} />
      </>
    );
  }

  const next = queue[1];
  const income = front.amount > 0;
  const kindAllowed = (c: CategoryOption) => c.kind === "transfer" || c.kind === (income ? "income" : "expense");
  const selectedCategory = categoryChoice[front.id] ?? front.categoryId ?? "";

  return (
    <>
      <div className="review-grid">
        <div>
          <div className="stack">
            {next && <div className="txn-card" data-depth="1" aria-hidden><p className="peek"><span>Next: <b>{next.merchant ?? "Transaction"}</b></span><span className={next.amount > 0 ? "num in" : "num"}>{formatPeso(next.amount, { signed: true })}</span></p></div>}
            {queue[2] && <div className="txn-card" data-depth="2" aria-hidden />}
            <SwipeCard
              key={front.id}
              exiting={exiting}
              onConfirm={confirm}
              onIgnore={ignore}
              label={`${front.merchant ?? "Transaction"}, ${formatPeso(front.amount, { signed: true })}`}
            >
              <div className="txn-top">
                <span className="inst" aria-hidden>{badgeFor(front.institutionName ?? front.accountName)}</span>
                <div className="txn-meta">
                  <p className="txn-acct">{front.accountLast4 ? `${front.accountName} ••${front.accountLast4}` : front.accountName}</p>
                  <p className="txn-src">
                    {front.source === "recurring" ? <Repeat aria-hidden /> : <Mail aria-hidden />}
                    {describeSource(front)}
                  </p>
                </div>
              </div>
              <div>
                <p className={income ? "flow in" : "flow"}>
                  {income ? <ArrowDownLeft aria-hidden /> : <ArrowUpRight aria-hidden />}
                  {income ? "Money in" : "Money out"}
                </p>
                <p className="txn-merchant">{front.merchant ?? "Unknown merchant"}</p>
              </div>
              <p className={income ? "txn-amount in" : "txn-amount"}>
                <span className="sign">{income ? "+" : "−"}</span>
                {formatPeso(Math.abs(front.amount)).replace(/\.\d\d$/, "")}
                <span className="cents">{formatPeso(Math.abs(front.amount)).slice(-3)}</span>
              </p>

              <label className="cat-field">
                <span className="vh">Category</span>
                <select
                  className="cat-select"
                  value={selectedCategory}
                  onChange={(e) => setCategoryChoice((c) => ({ ...c, [front.id]: e.target.value }))}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <option value="">Choose a category</option>
                  {categories.filter(kindAllowed).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              {front.duplicateOf && (
                <div className="flag" onPointerDown={(e) => e.stopPropagation()}>
                  <Copy aria-hidden />
                  <div>
                    <p>
                      <b>Possible duplicate.</b> You already have {formatPeso(front.duplicateOf.amount, { signed: true })}
                      {front.duplicateOf.merchant ? ` for ${front.duplicateOf.merchant}` : ""},{" "}
                      {front.duplicateOf.source === "manual" ? "added by you" : "from your email"} {describeWhen(front.duplicateOf.occurredAt)}.
                    </p>
                    <div className="flag-actions">
                      <button type="button" className="mini-btn" onClick={ignore}>Ignore this one</button>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => {
                          const target = front;
                          setQueue((q) => q.map((t) => (t.id === target.id ? { ...t, duplicateOf: null } : t)));
                          startTransition(async () => {
                            const result = await markNotDuplicate({ id: target.id });
                            if (!result.ok) showToast({ message: result.message, undoIds: null, error: true });
                          });
                        }}
                      >
                        Not a duplicate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {frontPair ? (
                <div className="transfer-hint" onPointerDown={(e) => e.stopPropagation()}>
                  <ArrowLeftRight aria-hidden />
                  <div>
                    <p>
                      <b>Looks like a transfer</b> from {frontPair.fromAccount} to {frontPair.toAccount}.
                    </p>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() =>
                        run([frontPair.outId, frontPair.inId], () => confirmAsTransfer(frontPair), {
                          message: `Recorded transfer to ${frontPair.toAccount}`,
                          undoIds: null,
                        }, "right")
                      }
                    >
                      Confirm as transfer
                    </button>
                  </div>
                </div>
              ) : transferPickerFor === front.id ? (
                <form
                  className="transfer-hint"
                  onPointerDown={(e) => e.stopPropagation()}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const other = String(new FormData(e.currentTarget).get("other") ?? "");
                    if (!other) return;
                    const otherName = accounts.find((a) => a.id === other)?.name ?? "your other account";
                    run([front.id], () => confirmOneSidedTransfer({ id: front.id, otherAccountId: other }), {
                      message: `Recorded transfer ${income ? "from" : "to"} ${otherName}`,
                      undoIds: null,
                    }, "right");
                  }}
                >
                  <ArrowLeftRight aria-hidden />
                  <div className="transfer-pick">
                    <label>
                      <span>{income ? "Transferred from" : "Transferred to"}</span>
                      <select name="other" className="cat-select" required defaultValue="">
                        <option value="" disabled>Choose an account</option>
                        {accounts.filter((a) => a.id !== front.accountId).map((a) => (
                          <option key={a.id} value={a.id}>{a.last4 ? `${a.name} ••${a.last4}` : a.name}</option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="mini-btn">Confirm transfer</button>
                  </div>
                </form>
              ) : (
                accounts.length > 1 && (
                  <button type="button" className="text-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTransferPickerFor(front.id)}>
                    <ArrowLeftRight aria-hidden />
                    It&apos;s a transfer between my accounts
                  </button>
                )
              )}
            </SwipeCard>
          </div>

          <div className="actions">
            <button className="btn" type="button" onClick={ignore}><X aria-hidden />Ignore</button>
            <button className="btn primary" type="button" onClick={confirm}><Check aria-hidden />Confirm</button>
          </div>
          <p className="kbd-hints"><span><kbd>C</kbd>Confirm</span><span><kbd>I</kbd>Ignore</span><span><kbd>U</kbd>Undo</span></p>
        </div>

        {variant === "page" ? (
          <div className="queue">
            <h3>Up next</h3>
            <ol>
              {queue.slice(1).length === 0 ? (
                <li className="q-empty">Nothing else waiting.</li>
              ) : (
                queue.slice(1, 12).map((t) => (
                  <li key={t.id} className="q-row">
                    <span className="inst" aria-hidden>{badgeFor(t.institutionName ?? t.accountName)}</span>
                    <div><p>{t.merchant ?? "Transaction"}</p><p>{t.accountName}</p></div>
                    <span className={t.amount > 0 ? "q-amt in" : "q-amt"}>{formatPeso(t.amount, { signed: true })}</span>
                  </li>
                ))
              )}
            </ol>
          </div>
        ) : (
          queue.length > 1 && (
            <p className="see-all"><Link href="/review" className="link">See all {queue.length} waiting</Link></p>
          )
        )}
      </div>
      <ToastBar toast={toast} onUndo={undo} />
    </>
  );
}

function SwipeCard({
  children,
  exiting,
  onConfirm,
  onIgnore,
  label,
}: {
  children: React.ReactNode;
  exiting: "left" | "right" | null;
  onConfirm: () => void;
  onIgnore: () => void;
  label: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ x0: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const className = ["txn-card", exiting === "right" && "out-right", exiting === "left" && "out-left", dragging && "dragging"]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={ref}
      className={className}
      data-depth="0"
      aria-label={label}
      style={dx && !exiting ? { transform: `translateX(${dx}px) rotate(${dx / 30}deg)` } : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x0: e.clientX, dx: 0 };
        setDragging(true);
        ref.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        drag.current.dx = e.clientX - drag.current.x0;
        setDx(drag.current.dx);
      }}
      onPointerUp={() => {
        const moved = drag.current?.dx ?? 0;
        drag.current = null;
        setDragging(false);
        setDx(0);
        if (moved > SWIPE_THRESHOLD) onConfirm();
        else if (moved < -SWIPE_THRESHOLD) onIgnore();
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
        setDx(0);
      }}
    >
      <span className="drag-hint ignore" style={{ opacity: Math.max(0, Math.min(1, -dx / 90)) }}><X aria-hidden />Ignore</span>
      <span className="drag-hint confirm" style={{ opacity: Math.max(0, Math.min(1, dx / 90)) }}><Check aria-hidden />Confirm</span>
      {children}
    </article>
  );
}

function ToastBar({ toast, onUndo }: { toast: Toast | null; onUndo: () => void }) {
  return (
    <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite" data-error={toast?.error || undefined}>
      <span>{toast?.message}</span>
      {toast?.undoIds && <button type="button" onClick={onUndo}>Undo</button>}
    </div>
  );
}

function petals() {
  const host = document.body;
  const card = document.querySelector<HTMLElement>('.txn-card[data-depth="0"]');
  if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = card.getBoundingClientRect();
  for (let i = 0; i < 9; i++) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    p.setAttribute("viewBox", "0 0 16 16");
    p.setAttribute("aria-hidden", "true");
    p.classList.add("petal");
    p.innerHTML = '<path fill="currentColor" d="M8 1c3 2.6 4.6 5.2 4.6 7.6A4.6 4.6 0 0 1 8 15a4.6 4.6 0 0 1-4.6-6.4C3.4 6.2 5 3.6 8 1Zm0 3.2L7 7.4h2L8 4.2Z"/>';
    p.style.position = "fixed";
    p.style.left = `${r.left + r.width * (0.2 + Math.random() * 0.6)}px`;
    p.style.top = `${r.top + r.height * 0.4}px`;
    p.style.setProperty("--dx", `${Math.random() * 160 - 40}px`);
    p.style.setProperty("--dy", `${-60 - Math.random() * 120}px`);
    p.style.setProperty("--rot", `${Math.random() * 360}deg`);
    p.style.animationDelay = `${i * 40}ms`;
    host.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}
