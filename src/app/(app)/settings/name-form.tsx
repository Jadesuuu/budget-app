"use client";

import { useActionState } from "react";
import { saveDisplayName, type NameState } from "./actions";

export function NameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState<NameState, FormData>(saveDisplayName, { status: "idle" });
  return (
    <form action={action} className="inline-form">
      <label className="field">
        <span>Your name</span>
        <input className="input" name="displayName" defaultValue={initialName} maxLength={80} autoComplete="name" />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </button>
      <p className={state.status === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {state.status === "saved" ? "Name saved" : state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
