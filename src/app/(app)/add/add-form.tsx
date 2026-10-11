"use client";

import { useActionState, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import type { AccountOption, CategoryOption } from "@/lib/data/inbox";
import { addEntry, type AddState } from "./actions";

const MODES = [
  { value: "out", label: "Money out", icon: ArrowUpRight },
  { value: "in", label: "Money in", icon: ArrowDownLeft },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight },
] as const;
type Mode = (typeof MODES)[number]["value"];

export function AddForm({ accounts, categories, today }: { accounts: AccountOption[]; categories: CategoryOption[]; today: string }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addEntry, { status: "idle" });
  const [mode, setMode] = useState<Mode>("out");
  const label = (a: AccountOption) => (a.last4 ? `${a.name} ••${a.last4}` : a.name);
  const kind = mode === "in" ? "income" : "expense";

  return (
    <form action={action} className="stack-form add-form" noValidate>
      <fieldset className="mode-seg">
        <legend className="vh">Kind of entry</legend>
        <div className="seg-row seg-wide">
          {MODES.map(({ value, label: text, icon: Icon }) => (
            <label key={value} className="seg-opt">
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="vh" />
              <Icon aria-hidden />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field amount-field">
        <span>Amount</span>
        <span className="peso-input big">
          <span aria-hidden>₱</span>
          <input className="input" name="amount" inputMode="decimal" placeholder="0.00" autoComplete="off" required autoFocus />
        </span>
      </label>

      {mode === "transfer" ? (
        <>
          <label className="field">
            <span>From</span>
            <select className="input" name="from" defaultValue="" required>
              <option value="" disabled>Choose an account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
            </select>
          </label>
          <div className="field">
            <label htmlFor="add-to">To</label>
            <select id="add-to" className="input" name="to" defaultValue="" required aria-describedby="add-to-hint">
              <option value="" disabled>Choose an account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
            </select>
            <span id="add-to-hint" className="hint">Paying a credit card from your bank account counts as a transfer too.</span>
          </div>
          <div className="field">
            <label htmlFor="add-fee">Fee <span className="optional">(optional)</span></label>
            <span className="peso-input">
              <span aria-hidden>₱</span>
              <input id="add-fee" className="input" name="fee" inputMode="decimal" placeholder="0.00" autoComplete="off" aria-describedby="add-fee-hint" />
            </span>
            <span id="add-fee-hint" className="hint">Recorded as its own expense, so it shows in your spending.</span>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>{mode === "out" ? "What was it for?" : "Where is it from?"}</span>
            <input className="input" name="merchant" maxLength={200} placeholder={mode === "out" ? "e.g. Jollibee, Meralco" : "e.g. Salary, Carla"} required />
          </label>
          <label className="field">
            <span>Account</span>
            <select className="input" name="account" defaultValue={accounts.length === 1 ? accounts[0].id : ""} required>
              <option value="" disabled>Choose an account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Category <span className="optional">(optional)</span></span>
            <select className="input" name="category" defaultValue="">
              <option value="">No category</option>
              {categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </>
      )}

      <div className="field-row">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" name="date" defaultValue={today} max={today} required />
        </label>
        <label className="field">
          <span>Time <span className="optional">(optional)</span></span>
          <input className="input" type="time" name="time" />
        </label>
      </div>

      <label className="field">
        <span>Note <span className="optional">(optional)</span></span>
        <input className="input" name="note" maxLength={1000} />
      </label>

      {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn" type="submit" name="again" value="1" disabled={pending}>Save and add another</button>
      </div>
    </form>
  );
}
