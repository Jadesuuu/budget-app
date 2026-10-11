import { formatPeso, type Centavos } from "@/lib/money";

export type DueItem = {
  key: string;
  kind: "statement" | "loan" | "installment";
  name: string;
  detail: string;
  dueDate: string;
  amount: Centavos;
  amountLabel: string;
};

type Payment = { id: string; dueDate: string; amount: number; seq: number; of: number | null; name: string };

export type DueSources = {
  statements: {
    id: string;
    dueDate: string;
    balance: number;
    minimumDue: number;
    paid: number;
    accountName: string;
    last4: string | null;
  }[];
  loanPayments: Payment[];
  installmentPayments: Payment[];
};

/** Combines all due sources into one list, earliest first. Statements already paid to the minimum drop out. */
export function mergeDueItems(input: DueSources): DueItem[] {
  const items: DueItem[] = [];
  for (const s of input.statements) {
    if (s.paid >= s.minimumDue) continue;
    items.push({
      key: `statement:${s.id}`,
      kind: "statement",
      name: s.last4 ? `${s.accountName} ••${s.last4}` : s.accountName,
      detail: `Statement balance ${formatPeso(s.balance)}`,
      dueDate: s.dueDate,
      amount: s.minimumDue - s.paid,
      amountLabel: s.paid > 0 ? "Minimum left" : "Minimum",
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
      });
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}
