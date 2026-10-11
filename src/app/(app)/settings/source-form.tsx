"use client";

import { useActionState } from "react";
import { addForwardingSource, type SourceState } from "./email-actions";

export function SourceForm() {
  const [state, action, pending] = useActionState<SourceState, FormData>(addForwardingSource, { status: "idle" });
  return (
    <form action={action} className="inline-form source-form">
      <div className="field">
        <label htmlFor="source-email">Add another mailbox you forward from</label>
        <input id="source-email" className="input" name="email" type="email" inputMode="email" placeholder="you@gmail.com" required />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add address"}</button>
      <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {state.status === "saved" ? "Address added" : state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
