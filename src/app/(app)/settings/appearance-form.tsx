"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEMES, applyAppearance, type Mode, type ThemeId } from "@/lib/themes";
import { saveAppearance } from "./actions";

const MODE_OPTIONS: { value: Mode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match device", icon: Monitor },
];

function subscribeToScheme(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function AppearanceForm({ initialTheme, initialMode }: { initialTheme: ThemeId; initialMode: Mode }) {
  const [theme, setTheme] = useState(initialTheme);
  const [mode, setMode] = useState(initialMode);
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const prefersDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark, () => false);
  const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  function choose(nextTheme: ThemeId, nextMode: Mode) {
    const previous = { theme, mode };
    setTheme(nextTheme);
    setMode(nextMode);
    applyAppearance(nextTheme, nextMode);
    startTransition(async () => {
      const result = await saveAppearance({ theme: nextTheme, mode: nextMode });
      if (result.ok) {
        setStatus({ kind: "saved" });
      } else {
        setTheme(previous.theme);
        setMode(previous.mode);
        applyAppearance(previous.theme, previous.mode);
        setStatus({ kind: "error", message: result.message });
      }
    });
  }

  return (
    <div className="appearance">
      <fieldset className="theme-grid">
        <legend className="vh">Theme</legend>
        {THEMES.map((t) => (
          <label key={t.id} className="theme-card" data-theme={t.id} data-mode={resolvedMode}>
            <input
              type="radio"
              name="theme"
              value={t.id}
              checked={theme === t.id}
              onChange={() => choose(t.id, mode)}
              className="vh"
            />
            <span className="tc-sample" aria-hidden>
              <span className="tc-amount">₱1,500</span>
              <span className="tc-pill">Confirm</span>
            </span>
            <span className="tc-text">
              <span className="tc-name">{t.name}</span>
              <span className="tc-feel">{t.feel}</span>
            </span>
            {theme === t.id && <Check className="tc-check" aria-hidden />}
          </label>
        ))}
      </fieldset>

      <fieldset className="mode-seg">
        <legend className="field-label">Light or dark</legend>
        <div className="seg-row">
          {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label key={value} className="seg-opt">
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => choose(theme, value)}
                className="vh"
              />
              <Icon aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <p className={status.kind === "error" ? "form-error" : "form-note"} role="status" aria-live="polite">
        {pending ? "Saving…" : status.kind === "saved" ? "Saved to your profile" : status.kind === "error" ? status.message : ""}
      </p>
    </div>
  );
}
