"use client";

import { useActionState, useEffect, useRef } from "react";
import { addBill, type DueState } from "../../due-actions";

/** Type in a bill from the bank app or a paper statement, for when no email or text brought it in. */
export function BillForm({ accountId, today, isCard }: { accountId: string; today: string; isCard: boolean }) {
  const [state, action, pending] = useActionState<DueState, FormData>(addBill, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "saved") form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="inline-form">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="field-row">
        <label className="field" htmlFor="bill-due">
          Due date
          <input id="bill-due" className="input" type="date" name="dueDate" required defaultValue="" min={today} />
        </label>
        <label className="field" htmlFor="bill-date">
          <span>{isCard ? "Statement date" : "Bill date"} <span className="optional">(optional)</span></span>
          <input id="bill-date" className="input" type="date" name="statementDate" max={today} />
        </label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor="bill-balance">
          {isCard ? "Statement balance" : "Amount due"}
          <span className="peso-input">
            <span aria-hidden>₱</span>
            <input id="bill-balance" className="input" name="balance" inputMode="decimal" placeholder="0.00" autoComplete="off" required />
          </span>
        </label>
        <label className="field" htmlFor="bill-min">
          <span>Minimum <span className="optional">(optional)</span></span>
          <span className="peso-input">
            <span aria-hidden>₱</span>
            <input id="bill-min" className="input" name="minimum" inputMode="decimal" placeholder="Same as amount" autoComplete="off" />
          </span>
        </label>
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Add bill"}</button>
      <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {state.status === "saved" ? "Added. It shows in Due soon on Home." : state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
