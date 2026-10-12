"use client";

import { useActionState, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { formatPeso } from "@/lib/money";
import { centavosToInput } from "@/lib/money-input";
import { saveSpendingPlan, type PlanState } from "../actions";

type Props = {
  income: number | null;
  limit: number | null;
  paydays: number[];
  /** What goals with a date need each month. */
  goalsPerMonth: number;
  /** What fixed bills will likely take this month. */
  fixedPerMonth: number;
  /** Loan and installment payments in the next month. */
  debtPerMonth: number;
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const dayLabel = (d: number) => (d === 31 ? "Last day" : String(d));

function DaySelect({ id, name, value, onChange }: { id: string; name: string; value: number; onChange: (v: number) => void }) {
  return (
    <select id={id} name={name} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {DAYS.map((d) => (
        <option key={d} value={d}>{dayLabel(d)}</option>
      ))}
    </select>
  );
}

export function PlanForm({ income, limit, paydays, goalsPerMonth, fixedPerMonth, debtPerMonth }: Props) {
  const [state, action, pending] = useActionState<PlanState, FormData>(saveSpendingPlan, { status: "idle" });
  const limitRef = useRef<HTMLInputElement>(null);
  const [twice, setTwice] = useState(paydays.length > 1);
  const [first, setFirst] = useState(paydays[0] ?? 1);
  const [second, setSecond] = useState(paydays[1] ?? 31);
  const suggestion = income !== null ? income - goalsPerMonth - fixedPerMonth - debtPerMonth : null;

  return (
    <form action={action} className="inline-form plan-form">
      <fieldset className="field payday-field">
        <legend className="field-label">Payday</legend>
        <div className="seg-row">
          <label className="seg-opt">
            <input className="vh" type="radio" name="payMode" value="once" checked={!twice} onChange={() => setTwice(false)} />
            Once a month
          </label>
          <label className="seg-opt">
            <input className="vh" type="radio" name="payMode" value="twice" checked={twice} onChange={() => { setTwice(true); if (first === 1) { setFirst(15); setSecond(31); } }} />
            Twice a month
          </label>
        </div>
        <div className="field-row">
          <label className="field" htmlFor="payday-1">
            {twice ? "First payday" : "Day"}
            <DaySelect id="payday-1" name="payday1" value={first} onChange={setFirst} />
          </label>
          {twice && (
            <label className="field" htmlFor="payday-2">
              Second payday
              <DaySelect id="payday-2" name="payday2" value={second} onChange={setSecond} />
            </label>
          )}
        </div>
        <p className="hint">
          {twice
            ? "Your monthly limit is split between the two pay periods. If you're paid on the 15th and 30th, pick 15 and Last day."
            : first === 1
              ? "Budget periods follow the calendar month."
              : `Budget periods run from the ${first === 31 ? "last day" : `${first}th`} to the day before the next payday.`}
        </p>
      </fieldset>

      <div className="field-row">
        <label className="field" htmlFor="plan-income">
          <span>Income a month <span className="optional">(optional)</span></span>
          <span className="peso-input">
            <span aria-hidden>₱</span>
            <input id="plan-income" className="input" name="income" inputMode="decimal" placeholder="0.00" autoComplete="off"
              defaultValue={income ? centavosToInput(income) : ""} />
          </span>
        </label>
        <label className="field" htmlFor="plan-limit">
          <span>Everyday spending a month</span>
          <span className="peso-input">
            <span aria-hidden>₱</span>
            <input id="plan-limit" ref={limitRef} className="input" name="limit" inputMode="decimal" placeholder="0.00" autoComplete="off"
              defaultValue={limit ? centavosToInput(limit) : ""} />
          </span>
        </label>
      </div>
      {suggestion !== null && income !== null && (
        <div className="plan-math">
          <dl>
            <div><dt>Income</dt><dd>{formatPeso(income)}</dd></div>
            {fixedPerMonth > 0 && <div><dt>Fixed bills</dt><dd>−{formatPeso(fixedPerMonth)}</dd></div>}
            {debtPerMonth > 0 && <div><dt>Loans and installments</dt><dd>−{formatPeso(debtPerMonth)}</dd></div>}
            {goalsPerMonth > 0 && <div><dt>Savings goals</dt><dd>−{formatPeso(goalsPerMonth)}</dd></div>}
            <div className="total">
              <dt>Left for everyday spending</dt>
              <dd>{suggestion > 0 ? formatPeso(suggestion) : `−${formatPeso(-suggestion)}`}</dd>
            </div>
          </dl>
          {suggestion > 0 ? (
            <button type="button" className="btn" onClick={() => {
              if (limitRef.current) limitRef.current.value = centavosToInput(suggestion);
            }}>Use {formatPeso(suggestion)}</button>
          ) : (
            <p className="plan-short">
              <CircleAlert aria-hidden />
              Your commitments are more than your income. Push a goal&apos;s date back or lower its target.
            </p>
          )}
        </div>
      )}
      <p className="hint">
        Everyday spending is everything except transfers, card payments, and the categories you mark as fixed bills below.
        Leave it empty to turn the daily amount off.
      </p>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save plan"}</button>
      <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {state.status === "saved" ? "Saved." : state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
