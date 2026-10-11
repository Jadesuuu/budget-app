"use client";

import { useActionState } from "react";
import { recordBankBalance, type CheckState } from "../actions";

/** Type the balance the bank app shows right now; it becomes a balance check. */
export function BalanceForm({ accountId, owed, bank }: { accountId: string; owed: boolean; bank: string }) {
  const [state, action, pending] = useActionState<CheckState, FormData>(recordBankBalance, { status: "idle" });
  return (
    <form action={action} className="inline-form balance-form">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="field">
        <label htmlFor="bank-balance">{owed ? `What ${bank} says you owe now` : `Balance ${bank} shows now`}</label>
        <span className="peso-input">
          <span aria-hidden>₱</span>
          <input id="bank-balance" className="input" name="amount" inputMode="decimal" placeholder="0.00" autoComplete="off" required />
        </span>
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Checking…" : "Check against Budget"}</button>
      <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {state.status === "saved" ? "Saved. The check above is updated." : state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
