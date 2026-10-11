"use client";

import Link from "next/link";
import { useActionState, useRef, useTransition } from "react";
import { CircleCheck, FileUp } from "lucide-react";
import { describeWhen } from "@/lib/inbox";
import { formatPeso } from "@/lib/money";
import { importFile, type ImportState } from "./actions";

export function ImportForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFile, { status: "idle" });
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Submitted by hand (not via form action) so the chosen file stays selected between Check and Import.
  function submit(intent: "preview" | "commit") {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("intent", intent);
    startTransition(() => action(data));
  }

  if (state.status === "done") {
    return (
      <div className="import-done" role="status">
        <CircleCheck aria-hidden />
        <p>
          <b>Imported.</b> {state.matched} already in Budget, {state.added} added to Review.
        </p>
        <Link href="/review" className="btn primary">Review the new transactions</Link>
      </div>
    );
  }

  return (
    <form ref={formRef} className="stack-form import-form" onSubmit={(e) => { e.preventDefault(); submit("preview"); }}>
      <input type="hidden" name="accountId" value={accountId} />
      <div className="field">
        <label htmlFor="import-file">History or statement file</label>
        <input id="import-file" className="input file-input" type="file" name="file" accept=".csv,.pdf,text/csv,application/pdf" required />
      </div>
      <div className="field">
        <label htmlFor="import-password">PDF password <span className="optional">(if it has one)</span></label>
        <input id="import-password" className="input" type="password" name="password" autoComplete="off" aria-describedby="import-password-hint" />
        <span id="import-password-hint" className="hint">Used once to open the file. Budget never saves it.</span>
      </div>

      {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}

      {state.status !== "preview" ? (
        <button className="btn primary" type="submit" disabled={pending}>
          <FileUp aria-hidden />
          {pending ? "Reading…" : "Check file"}
        </button>
      ) : (
        <div className="import-preview" aria-live="polite">
          <p>
            <b>{state.fileName}</b>: {state.total} transactions. {state.matched} are already in Budget
            {state.skipped > 0 ? `, ${state.skipped} rows couldn't be read` : ""}.
          </p>
          {state.closing && (
            <p className="hint">
              The file ends with a balance of {formatPeso(state.closing.balanceCentavos)}; it becomes a balance check.
            </p>
          )}
          {state.missing.length > 0 ? (
            <>
              <h3 className="settings-sub">Missing from Budget ({state.missing.length})</h3>
              <PreviewList lines={state.missing} />
            </>
          ) : (
            <p className="form-success">Nothing missing. Budget already has every transaction in this file.</p>
          )}
          {state.notInFile.length > 0 && (
            <>
              <h3 className="settings-sub">In Budget but not in this file ({state.notInFile.length})</h3>
              <p className="hint">Often a manual entry the bank recorded differently, or a duplicate. Worth a look.</p>
              <PreviewList lines={state.notInFile} />
            </>
          )}
          <div className="form-actions">
            <button className="btn primary" type="button" disabled={pending} onClick={() => submit("commit")}>
              {pending ? "Importing…" : state.missing.length ? `Add ${state.missing.length} to Review` : "Record balance check"}
            </button>
            <button className="btn" type="button" disabled={pending} onClick={() => submit("preview")}>Check again</button>
          </div>
        </div>
      )}
    </form>
  );
}

function PreviewList({ lines }: { lines: { occurredAt: string; amountCentavos: number; description: string }[] }) {
  return (
    <ul className="row-list">
      {lines.slice(0, 50).map((l, i) => (
        <li key={i} className="row">
          <div>
            <p className="row-title">{l.description}</p>
            <p className="row-sub">{describeWhen(l.occurredAt)}</p>
          </div>
          <p className={l.amountCentavos > 0 ? "row-amt in" : "row-amt"}>{formatPeso(l.amountCentavos, { signed: true })}</p>
        </li>
      ))}
      {lines.length > 50 && <li className="row row-sub">and {lines.length - 50} more</li>}
    </ul>
  );
}
