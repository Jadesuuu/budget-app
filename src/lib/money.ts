// Money is always integer centavos (PHP). Never floats.

export type Centavos = number;

export function assertCentavos(value: number): asserts value is Centavos {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Money must be an integer number of centavos, got ${value}`);
  }
}

/** Formats centavos as "₱1,234.56". Uses U+2212 for negatives when `signed`. */
export function formatPeso(centavos: Centavos, opts: { signed?: boolean } = {}): string {
  assertCentavos(centavos);
  const abs = Math.abs(centavos);
  const whole = Math.trunc(abs / 100).toLocaleString("en-PH");
  const cents = String(abs % 100).padStart(2, "0");
  const sign = opts.signed ? (centavos < 0 ? "−" : centavos > 0 ? "+" : "") : centavos < 0 ? "−" : "";
  return `${sign}₱${whole}.${cents}`;
}
