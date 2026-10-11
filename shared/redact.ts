// Shared by the email Worker and the app. CLAUDE.md: never store full card or account numbers.

// 13-19 digits, optionally separated by single spaces or dashes (how card numbers are printed).
const CARD_CANDIDATE = /(?<![\d*])(?:\d[ -]?){12,18}\d(?![\d*])/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Masks anything that looks like a payment card number (13-19 digits passing the Luhn check), keeping the
 * last 4: "4111 1111 1111 1111" -> "************1111". Reference numbers that fail the Luhn check are left alone.
 */
export function redactCardNumbers(text: string): string {
  return text.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) return match;
    return "*".repeat(digits.length - 4) + digits.slice(-4);
  });
}

export function containsCardNumber(text: string): boolean {
  return redactCardNumbers(text) !== text;
}
