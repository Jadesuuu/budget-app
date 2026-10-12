"use client";

import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveCategorySetting } from "@/app/(app)/spending/actions";
import { formatPeso } from "@/lib/money";
import { centavosToInput } from "@/lib/money-input";

type Props = {
  id: string;
  name: string;
  fixed: boolean;
  limit: number | null;
  /** Shown as the empty field's hint, so a sensible limit is one glance away. */
  lastMonth: number;
  /** Inline on the Spending page: only the limit; the fixed switch lives on the Plan page. */
  compact?: boolean;
};

/** One category's settings. Each change saves by itself: the switch at once, the limit when you leave the field. */
export function CategoryControls({ id, name, fixed: initialFixed, limit, lastMonth, compact = false }: Props) {
  const [fixed, setFixed] = useState(initialFixed);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const initial = limit ? centavosToInput(limit) : "";
  const saved = useRef(initial);

  const save = (nextFixed: boolean) =>
    start(async () => {
      const value = input.current?.value ?? "";
      const result = await saveCategorySetting({ categoryId: id, fixed: nextFixed, limit: value });
      if (result.ok) {
        saved.current = value.trim();
        setStatus({ text: "Saved" });
      } else setStatus({ text: result.message, error: true });
    });

  return (
    <div className={compact ? "cat-controls compact" : "cat-controls"}>
      {!compact && (
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={fixed}
            disabled={pending}
            onChange={(e) => {
              setFixed(e.target.checked);
              save(e.target.checked);
            }}
          />
          <span className="switch-track" aria-hidden />
          <span>Fixed bill<span className="vh"> ({name})</span></span>
        </label>
      )}
      <label className="cat-limit-field">
        <span className={compact ? "vh" : "cat-limit-label"}>Monthly limit<span className="vh"> for {name}</span></span>
        <span className="peso-input">
          <span aria-hidden>₱</span>
          <input
            ref={input}
            className="input"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial}
            placeholder={lastMonth > 0 ? `Last month ${formatPeso(lastMonth).replace(/\.00$/, "")}` : "No limit"}
            onBlur={(e) => {
              if (e.currentTarget.value.trim() !== saved.current) save(fixed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </span>
      </label>
      <p className={status?.error ? "cat-status form-error" : "cat-status"} role="status" aria-live="polite">
        {pending ? "Saving…" : status?.error ? status.text : status ? <><Check aria-hidden /> {status.text}</> : ""}
      </p>
    </div>
  );
}
