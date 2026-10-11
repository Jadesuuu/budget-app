import "server-only";
import { getSession } from "@/lib/auth";
import { addDays, todayInManila } from "@/lib/dates";
import { mergeDueItems, type DueItem } from "./due-items";

const WINDOW_DAYS = 30;
const OVERDUE_LOOKBACK_DAYS = 90;

/** Unpaid statements, loan and installment payments due in the next 30 days, plus recent overdue ones. */
export async function getDueSoon(): Promise<{ today: string; items: DueItem[] }> {
  const { supabase } = await getSession();
  const today = todayInManila();
  const until = addDays(today, WINDOW_DAYS);
  const from = addDays(today, -OVERDUE_LOOKBACK_DAYS);

  const [statements, loanPayments, installmentPayments] = await Promise.all([
    supabase
      .from("statements")
      .select(
        "id, due_date, statement_balance_centavos, minimum_due_centavos, amount_paid_centavos, accounts(name, last4)",
      )
      .gte("due_date", from)
      .lte("due_date", until),
    supabase
      .from("loan_payments")
      .select("id, seq, due_date, amount_centavos, loans(term_months, accounts(name))")
      .is("paid_at", null)
      .gte("due_date", from)
      .lte("due_date", until),
    supabase
      .from("installment_payments")
      .select("id, seq, due_date, amount_centavos, installment_plans(description, installments)")
      .is("paid_at", null)
      .gte("due_date", from)
      .lte("due_date", until),
  ]);
  if (statements.error) throw statements.error;
  if (loanPayments.error) throw loanPayments.error;
  if (installmentPayments.error) throw installmentPayments.error;

  return {
    today,
    items: mergeDueItems({
      statements: statements.data.map((s) => ({
        id: s.id,
        dueDate: s.due_date,
        balance: s.statement_balance_centavos,
        minimumDue: s.minimum_due_centavos,
        paid: s.amount_paid_centavos,
        accountName: s.accounts?.name ?? "Credit card",
        last4: s.accounts?.last4 ?? null,
      })),
      loanPayments: loanPayments.data.map((p) => ({
        id: p.id,
        dueDate: p.due_date,
        amount: p.amount_centavos ?? 0,
        seq: p.seq,
        of: p.loans?.term_months ?? null,
        name: p.loans?.accounts?.name ?? "Loan",
      })),
      installmentPayments: installmentPayments.data.map((p) => ({
        id: p.id,
        dueDate: p.due_date,
        amount: p.amount_centavos,
        seq: p.seq,
        of: p.installment_plans?.installments ?? null,
        name: p.installment_plans?.description ?? "Installment",
      })),
    }),
  };
}
