"use client";

import { useActionState, useState } from "react";
import { createAccount, updateAccount, type FormState } from "./actions";

export type InstitutionOption = { id: string; name: string; kind: string; own: boolean };

const TYPES = [
  { value: "savings", label: "Savings" },
  { value: "debit", label: "Debit / checking" },
  { value: "ewallet", label: "E-wallet" },
  { value: "credit", label: "Credit card" },
  { value: "bnpl", label: "Buy now, pay later" },
  { value: "loan", label: "Loan" },
] as const;

const OWED = new Set(["credit", "bnpl", "loan"]);
const GROUPS: { kind: string; label: string }[] = [
  { kind: "bank", label: "Banks" },
  { kind: "ewallet", label: "E-wallets" },
  { kind: "bnpl", label: "Buy now, pay later" },
  { kind: "other", label: "Other" },
];

type Existing = {
  id: string;
  name: string;
  type: string;
  last4: string | null;
  institutionId: string;
  balanceInput: string;
  /** Exact stored moment of the opening balance, and its Manila date for the date field. */
  balanceAt: string;
  balanceDate: string;
};

export function AccountForm({
  institutions,
  existing,
  today,
}: {
  institutions: InstitutionOption[];
  existing?: Existing;
  /** Today in Manila, from the server, so the date field never disagrees with the server's clock. */
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(existing ? updateAccount : createAccount, { status: "idle" });
  const [type, setType] = useState(existing?.type ?? "savings");
  const [institution, setInstitution] = useState(existing?.institutionId ?? "");
  const own = institutions.filter((i) => i.own);

  return (
    <form action={action} className="stack-form account-form" noValidate>
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <label className="field">
        <span>Bank or e-wallet</span>
        <select
          className="input"
          name="institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          disabled={Boolean(existing)}
          required
        >
          <option value="" disabled>Choose one</option>
          {own.length > 0 && (
            <optgroup label="Added by you">
              {own.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </optgroup>
          )}
          {GROUPS.map((g) => (
            <optgroup key={g.kind} label={g.label}>
              {institutions.filter((i) => !i.own && i.kind === g.kind).map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </optgroup>
          ))}
          {!existing && <option value="__new">Not listed: add mine</option>}
        </select>
      </label>
      {institution === "__new" && (
        <label className="field">
          <span>Name of your bank or e-wallet</span>
          <input className="input" name="newInstitution" maxLength={80} required autoFocus />
        </label>
      )}

      <label className="field">
        <span>Type</span>
        <select className="input" name="type" value={type} onChange={(e) => setType(e.target.value)} disabled={Boolean(existing)}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {existing && <input type="hidden" name="type" value={type} />}
      </label>

      <label className="field">
        <span>Account name</span>
        <input className="input" name="name" defaultValue={existing?.name} maxLength={80} placeholder="e.g. BPI Savings, Atome" required />
      </label>

      {type !== "ewallet" && (
        <div className="field">
          <label htmlFor="acct-last4">Last 4 digits <span className="optional">(optional)</span></label>
          <input
            id="acct-last4"
            aria-describedby="acct-last4-hint"
            className="input"
            name="last4"
            defaultValue={existing?.last4 ?? ""}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="off"
          />
          <span id="acct-last4-hint" className="hint">Only the last 4. Budget never stores full card or account numbers.</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="acct-balance">{OWED.has(type) ? "Amount you owe right now" : "Current balance"}</label>
        <span className="peso-input">
          <span aria-hidden>₱</span>
          <input id="acct-balance" aria-describedby="acct-balance-hint" className="input" name="balance" defaultValue={existing?.balanceInput ?? ""} inputMode="decimal" placeholder="0.00" autoComplete="off" />
        </span>
        <span id="acct-balance-hint" className="hint">
          {OWED.has(type)
            ? "From your latest statement or app. Payments and new charges are added on top."
            : "From your bank or e-wallet app. Confirmed transactions are added on top."}
        </span>
      </div>

      <div className="field">
        <label htmlFor="acct-balance-date">Balance as of</label>
        <input
          id="acct-balance-date"
          className="input"
          type="date"
          name="balanceDate"
          defaultValue={existing?.balanceDate ?? today}
          max={today}
          required
          aria-describedby="acct-balance-date-hint"
        />
        {existing?.balanceAt && <input type="hidden" name="originalBalanceAt" value={existing.balanceAt} />}
        <span id="acct-balance-date-hint" className="hint">
          Only transactions from this date on change the balance. Older ones still show in your history.
        </span>
      </div>

      {state.status === "error" && <p className="form-error" role="alert">{state.message}</p>}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Add account"}
      </button>
    </form>
  );
}
