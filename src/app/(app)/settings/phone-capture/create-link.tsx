"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { createCaptureLink, type CreateLinkState } from "./actions";

export function CreateLinkForm() {
  const [state, action, pending] = useActionState<CreateLinkState, FormData>(createCaptureLink, { status: "idle" });

  if (state.status === "created") {
    return (
      <div className="new-link" role="status">
        <p>
          Your link for <b>{state.label}</b>. Copy it into your phone now: for your safety it won&apos;t be shown again.
        </p>
        <div className="alias-box">
          <code>{state.url}</code>
          <CopyButton value={state.url} label="Copy link" />
        </div>
        <div className="warning-box" role="note">
          <TriangleAlert aria-hidden />
          <p>Anyone with this link can add transactions to your Review inbox. Keep it private, and revoke it if a phone is lost.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="inline-form">
      <div className="field">
        <label htmlFor="link-label">Name this phone</label>
        <input id="link-label" className="input" name="label" maxLength={60} placeholder="e.g. My Android" required />
      </div>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create capture link"}</button>
      {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
    </form>
  );
}
