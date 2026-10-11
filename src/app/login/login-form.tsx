"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ mailboxUrl }: { mailboxUrl: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="login-sent" role="status">
        <Mail aria-hidden />
        <h2>Check your email</h2>
        <p>
          If <b>{state.email}</b> has access, a sign-in link is on its way. It works once and expires in an hour.
        </p>
        {mailboxUrl && (
          <a className="btn" href={mailboxUrl} target="_blank" rel="noreferrer">
            Open local mailbox
          </a>
        )}
        <button className="link-btn" type="button" onClick={() => window.location.reload()}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="stack-form" noValidate>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" name="email" autoComplete="email" inputMode="email" required autoFocus />
      </label>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
