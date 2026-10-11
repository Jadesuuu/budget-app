import type { Centavos } from "./money";

const MAX_CENTAVOS = 100_000_000_000; // PHP 1 billion: far above any personal transaction, well inside safe integers.

/**
 * Parses what a person types ("1,234.5", "₱ 289", "1500.00") into integer centavos without floats.
 * Returns null for anything that isn't a positive amount with at most two decimals.
 */
export function parsePesoInput(raw: string): Centavos | null {
  const cleaned = raw.trim().replace(/^₱\s*/, "").replace(/^php\s*/i, "").replace(/,/g, "");
  const match = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = whole * 100 + cents;
  if (total <= 0 || total > MAX_CENTAVOS) return null;
  return total;
}

/** Centavos back to an editable string, e.g. 123456 -> "1234.56". */
export function centavosToInput(centavos: Centavos): string {
  const abs = Math.abs(centavos);
  return `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
