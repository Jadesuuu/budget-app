/**
 * Reads a labelled value from receipt-style text, where the value follows the label on the same line
 * ("Transfer Amount PHP 15,000.00") or on the next line ("Bill Amount\n556.00"), with an optional colon.
 * The label must start a line, so "Bank" doesn't match inside "Bank Transfer".
 */
export function field(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(String.raw`(?:^|\n)[ \t]*${escaped}[ \t]*:?[ \t]*(?:\n[ \t]*:?[ \t]*)?([^\n]*\S)`, "i").exec(text);
  return m ? m[1].trim() : null;
}

/** Last 4 digits from a masked number such as "******5678" or "XXXXXXXXXX5678". */
export function maskedLast4(text: string | null): string | null {
  return text ? (/(\d{4})\s*$/.exec(text)?.[1] ?? null) : null;
}
