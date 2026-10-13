import { formatPeso, type Centavos } from "@/lib/money";

export type DueItem = {
  key: string;
  kind: "statement" | "loan" | "installment";
  name: string;
  detail: string;
  dueDate: string;
  amount: Centavos;
  amountLabel: string;
  /** False for a reminder that gave only the due date (SPayLater): amount, fullAmount and minimumLeft are 0. */
  amountKnown: boolean;
  /** What clears it: a card statement's whole unpaid balance (no interest), otherwise the payment itself. */
  fullAmount: Centavos;
  /** Card statements: the minimum is paid, so it can't be late; what's shown is the rest of the balance. */
  minimumMet: boolean;
  /** What "Paid minimum" would pay now (0 once met). */
  minimumLeft: Centavos;
};

type Payment = { id: string; dueDate: string; amount: number; seq: number; of: number | null; name: string };

export type DueSources = {
  statements: {
    id: string;
    dueDate: string;
    /** Null when only the due date is known. */
    balance: number | null;
    minimumDue: number;
    paid: number;
    accountName: string;
    last4: string | null;
  }[];
  loanPayments: Payment[];
  installmentPayments: Payment[];
};

/**
 * Combines all due sources into one list, earliest first. A statement paid in full drops out. One paid to its
 * minimum stays until its due date as "left to pay in full" (never late), so the rest isn't forgotten.
 */
export function mergeDueItems(input: DueSources, today?: string): DueItem[] {
  const items: DueItem[] = [];
  for (const s of input.statements) {
    const name = s.last4 ? `${s.accountName} ••${s.last4}` : s.accountName;
    if (s.balance === null) {
      // Any payment recorded against an unknown amount counts as paying the bill.
      if (s.paid > 0) continue;
      items.push({
        key: `statement:${s.id}`,
        kind: "statement",
        name,
        detail: "The reminder didn't say how much",
        dueDate: s.dueDate,
        amount: 0,
        amountLabel: "Amount not stated",
        amountKnown: false,
        fullAmount: 0,
        minimumMet: false,
        minimumLeft: 0,
      });
      continue;
    }
    const unpaid = Math.max(0, s.balance - s.paid);
    if (unpaid === 0) continue;
    if (s.paid >= s.minimumDue) {
      if (today && s.dueDate < today) continue;
      items.push({
        key: `statement:${s.id}`,
        kind: "statement",
        name,
        detail: `Minimum paid, statement ${formatPeso(s.balance)}`,
        dueDate: s.dueDate,
        amount: unpaid,
        amountLabel: "Left to pay in full",
        amountKnown: true,
        fullAmount: unpaid,
        minimumMet: true,
        minimumLeft: 0,
      });
      continue;
    }
    items.push({
      key: `statement:${s.id}`,
      kind: "statement",
      name,
      detail: `Statement balance ${formatPeso(s.balance)}`,
      dueDate: s.dueDate,
      amount: s.minimumDue - s.paid,
      amountLabel: s.paid > 0 ? "Minimum left" : "Minimum",
      amountKnown: true,
      fullAmount: unpaid,
      minimumMet: false,
      minimumLeft: s.minimumDue - s.paid,
    });
  }
  for (const [kind, payments, amountLabel] of [
    ["loan", input.loanPayments, "Amortization"],
    ["installment", input.installmentPayments, "Installment"],
  ] as const) {
    for (const p of payments) {
      items.push({
        key: `${kind}:${p.id}`,
        kind,
        name: p.name,
        detail: p.of ? `Payment ${p.seq} of ${p.of}` : `Payment ${p.seq}`,
        dueDate: p.dueDate,
        amount: p.amount,
        amountLabel,
        amountKnown: true,
        fullAmount: p.amount,
        minimumMet: false,
        minimumLeft: p.amount,
      });
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}
