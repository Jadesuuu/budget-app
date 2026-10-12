"use client";

import { useActionState, useEffect, useRef } from "react";
import { centavosToInput } from "@/lib/money-input";
import { moveGoalMoney, saveGoal, type GoalState } from "./actions";

const idle: GoalState = { status: "idle" };

function Status({ state, saved }: { state: GoalState; saved: string }) {
  return (
    <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
      {state.status === "saved" ? saved : state.status === "error" ? state.message : ""}
    </p>
  );
}

/** Put money in or take it out. Clears the amount after each save. */
export function MoveMoneyForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(moveGoalMoney, idle);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "saved") form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="goal-move">
      <input type="hidden" name="id" value={id} />
      <label className="vh" htmlFor={`move-${id}`}>Amount for {name}</label>
      <span className="peso-input">
        <span aria-hidden>₱</span>
        <input id={`move-${id}`} className="input" name="amount" inputMode="decimal" placeholder="0.00" autoComplete="off" required />
      </span>
      <button className="btn" type="submit" name="direction" value="in" disabled={pending} aria-label={`Add to ${name}`}>Add</button>
      <button className="btn" type="submit" name="direction" value="out" disabled={pending} aria-label={`Take out of ${name}`}>Take out</button>
      <Status state={state} saved="Updated." />
    </form>
  );
}

type Existing = { id: string; name: string; target: number; targetDate: string | null; accountId: string | null };
export type AccountOption = { id: string; name: string };

export function GoalForm({ existing, today, accounts }: { existing?: Existing; today: string; accounts: AccountOption[] }) {
  const [state, action, pending] = useActionState(saveGoal, idle);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "saved" && !existing) form.current?.reset();
  }, [state, existing]);
  const key = existing?.id ?? "new";
  return (
    <form ref={form} action={action} className="inline-form">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <label className="field" htmlFor={`goal-name-${key}`}>
        Name
        <input id={`goal-name-${key}`} className="input" name="name" maxLength={80} required placeholder="Emergency fund, Japan trip, new phone"
          defaultValue={existing?.name} />
      </label>
      <div className="field-row">
        <label className="field" htmlFor={`goal-target-${key}`}>
          Target
          <span className="peso-input">
            <span aria-hidden>₱</span>
            <input id={`goal-target-${key}`} className="input" name="target" inputMode="decimal" placeholder="0.00" autoComplete="off" required
              defaultValue={existing ? centavosToInput(existing.target) : ""} />
          </span>
        </label>
        <label className="field" htmlFor={`goal-date-${key}`}>
          <span>By <span className="optional">(optional)</span></span>
          <input id={`goal-date-${key}`} className="input" type="date" name="targetDate" min={today}
            defaultValue={existing?.targetDate ?? ""} />
        </label>
      </div>
      {accounts.length > 0 && (
        <label className="field" htmlFor={`goal-account-${key}`}>
          <span>Saving in a separate account? <span className="optional">(optional)</span></span>
          <select id={`goal-account-${key}`} className="input" name="account" defaultValue={existing?.accountId ?? ""}>
            <option value="">No, I&apos;ll record what I put aside</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>Use {a.name}&apos;s balance</option>
            ))}
          </select>
          <span className="hint">With an account, progress follows its balance on its own, and it isn&apos;t counted as cash you can spend.</span>
        </label>
      )}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Add goal"}
      </button>
      <Status state={state} saved={existing ? "Saved." : "Goal added."} />
    </form>
  );
}
