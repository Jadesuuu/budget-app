import { describe, expect, it } from "vitest";
import {
  addMonths,
  everydayByDate,
  expectedFixed,
  findRepeatCharges,
  limitStatuses,
  payPeriod,
  safeToSpend,
  allowance,
  classify,
  cumulative,
  goalPlan,
  spentByDay,
  summarizeMonth,
  type SpendingTxn,
} from "./spending";

const food = { id: "food", name: "Food", kind: "expense" as const };
const salary = { id: "salary", name: "Salary", kind: "income" as const };
const transfer = { id: "transfer", name: "Transfer", kind: "transfer" as const };

function txn(amount: number, occurredAt: string, extra: Partial<SpendingTxn> = {}): SpendingTxn {
  return { amount, occurredAt, merchant: null, category: null, owedAccount: false, pending: false, ...extra };
}

describe("classify", () => {
  it("counts money out as spending and money in as income", () => {
    expect(classify(txn(-15000, "2026-10-01T00:00:00Z"))).toEqual({ kind: "spend", amount: 15000 });
    expect(classify(txn(2500000, "2026-10-01T00:00:00Z", { category: salary }))).toEqual({ kind: "income", amount: 2500000 });
  });

  it("treats a refund as negative spending", () => {
    expect(classify(txn(15000, "2026-10-01T00:00:00Z", { category: food }))).toEqual({ kind: "spend", amount: -15000 });
  });

  it("ignores transfers and uncategorized money into a card", () => {
    expect(classify(txn(-500000, "2026-10-01T00:00:00Z", { category: transfer }))).toBeNull();
    expect(classify(txn(500000, "2026-10-01T00:00:00Z", { owedAccount: true }))).toBeNull();
  });
});

describe("summarizeMonth", () => {
  it("buckets by Manila day and ranks categories and merchants", () => {
    const s = summarizeMonth("2026-10", [
      // 2026-09-30 16:30 UTC is already Oct 1 in Manila
      txn(-10000, "2026-09-30T16:30:00Z", { category: food, merchant: "Jollibee" }),
      txn(-5000, "2026-10-01T02:00:00Z", { category: food, merchant: "jollibee " }),
      txn(-30000, "2026-10-02T02:00:00Z", { merchant: "Shopee" }),
      txn(2500000, "2026-10-15T02:00:00Z", { category: salary }),
      txn(-99900, "2026-09-29T02:00:00Z"), // September: left out
    ]);
    expect(s.spent).toBe(45000);
    expect(s.income).toBe(2500000);
    expect(s.daily.length).toBe(31);
    expect(s.daily.slice(0, 2)).toEqual([15000, 30000]);
    expect(s.categories).toEqual([
      { id: "none", name: "Uncategorized", total: 30000, fixed: false },
      { id: "food", name: "Food", total: 15000, fixed: false },
    ]);
    expect(s.merchants[1]).toEqual({ name: "Jollibee", total: 15000, count: 2 });
  });

  it("keeps what's still to review out of the totals and reports money out beside them", () => {
    const s = summarizeMonth("2026-10", [
      txn(-500000, "2026-10-12T02:00:00Z", { merchant: "InstaPay to GCash", pending: true }),
      txn(500000, "2026-10-12T02:01:00Z", { merchant: "Cash in from BPI", pending: true }),
      txn(-28900, "2026-10-12T03:00:00Z", { category: food, pending: true }),
    ]);
    expect(s.spent).toBe(0);
    expect(s.income).toBe(0);
    expect(s.pendingCount).toBe(2);
    expect(s.pendingOut).toBe(528900);
  });
});

describe("month helpers", () => {
  it("steps across years", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-10", -5)).toBe("2026-05");
  });

  it("totals by day", () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
    expect(spentByDay([1, 2, 3], 2)).toBe(3);
    expect(spentByDay([1, 2, 3], 31)).toBe(6);
  });
});

describe("allowance", () => {
  const days = (spent: Record<number, number>, length = 31) =>
    Array.from({ length }, (_, i) => spent[i + 1] ?? 0);

  it("splits the month evenly when nothing is spent", () => {
    const a = allowance(3100000, days({}), 0);
    expect(a.perDay).toBe(100000);
    expect(a.todayShare).toBe(100000);
    expect(a.leftToday).toBe(100000);
    expect(a.daysLeft).toBe(31);
  });

  it("shrinks later days after overspending and counts today's spending against today", () => {
    // ₱31,000 for October; ₱5,000 spent on the 1st, ₱400 so far on the 12th.
    const a = allowance(3100000, days({ 1: 500000, 12: 40000 }), 11);
    expect(a.daysLeft).toBe(20);
    expect(a.todayShare).toBe(130000); // (31,000 − 5,000) / 20
    expect(a.leftToday).toBe(90000);
    expect(a.leftForPeriod).toBe(2560000);
    expect(a.perDayAfterToday).toBe(134736); // 25,600 / 19, rounded down
    expect(a.paceTarget).toBe(1200000);
  });

  it("goes negative when today is over its share, and never shares out money already overspent", () => {
    expect(allowance(3100000, days({ 12: 200000 }), 11).leftToday).toBeLessThan(0);
    const broke = allowance(100000, days({ 1: 500000 }), 11);
    expect(broke.todayShare).toBe(0);
    expect(broke.perDayAfterToday).toBe(0);
    expect(broke.leftForPeriod).toBe(-400000);
  });

  it("has no days after the last day", () => {
    expect(allowance(3000000, days({}, 30), 29).perDayAfterToday).toBe(0);
  });
});

describe("goalPlan", () => {
  it("spreads what's left over the months to the date, rounding up", () => {
    const p = goalPlan({ target: 10000000, saved: 1000000, targetDate: "2027-03-31" }, "2026-10-12");
    expect(p.monthsLeft).toBe(6); // Oct to Mar
    expect(p.perMonth).toBe(1500000);
    expect(p.reached).toBe(false);
  });

  it("handles goals without a date, reached, or past their date", () => {
    expect(goalPlan({ target: 100, saved: 0, targetDate: null }, "2026-10-12").perMonth).toBeNull();
    expect(goalPlan({ target: 100, saved: 150, targetDate: "2027-01-01" }, "2026-10-12").reached).toBe(true);
    expect(goalPlan({ target: 100, saved: 0, targetDate: "2026-10-01" }, "2026-10-12").late).toBe(true);
  });
});

describe("payPeriod", () => {
  it("is the calendar month with payday 1", () => {
    expect(payPeriod("2026-10-12", [1])).toEqual({ start: "2026-10-01", end: "2026-10-31", days: 31, perMonth: 1 });
  });

  it("splits kinsenas and katapusan, with 31 meaning the last day", () => {
    expect(payPeriod("2026-10-12", [15, 31])).toMatchObject({ start: "2026-09-30", end: "2026-10-14", perMonth: 2 });
    expect(payPeriod("2026-10-15", [15, 31])).toMatchObject({ start: "2026-10-15", end: "2026-10-30" });
    expect(payPeriod("2026-10-31", [15, 31])).toMatchObject({ start: "2026-10-31", end: "2026-11-14" });
    expect(payPeriod("2027-02-28", [15, 31])).toMatchObject({ start: "2027-02-28", end: "2027-03-14" });
  });

  it("handles a mid-month payday", () => {
    expect(payPeriod("2026-10-12", [25])).toMatchObject({ start: "2026-09-25", end: "2026-10-24", days: 30 });
  });
});

describe("fixed bills", () => {
  const rent = { id: "rent", name: "Rent", kind: "expense" as const };
  const txns = [
    txn(-1200000, "2026-10-01T02:00:00Z", { category: rent }),
    txn(-20000, "2026-10-01T03:00:00Z", { category: food }),
    txn(-5000, "2026-10-02T03:00:00Z", { category: food, pending: true }),
  ];

  it("keeps fixed categories out of the everyday daily amounts", () => {
    const s = summarizeMonth("2026-10", txns, new Set(["rent"]));
    expect(s.spent).toBe(1220000);
    expect(s.fixedSpent).toBe(1200000);
    expect(s.daily[0]).toBe(20000);
    expect(s.categories[0]).toMatchObject({ id: "rent", fixed: true });
  });

  it("buckets everyday spending across a period, optionally with what's still to review", () => {
    expect(everydayByDate(txns, "2026-09-30", "2026-10-02", new Set(["rent"]))).toEqual([0, 20000, 0]);
    expect(everydayByDate(txns, "2026-09-30", "2026-10-02", new Set(["rent"]), { includePending: true })).toEqual([0, 20000, 5000]);
  });

  it("expects each fixed category's limit, or last month's amount", () => {
    const last = summarizeMonth("2026-09", [txn(-234156, "2026-09-10T02:00:00Z", { category: { id: "bills", name: "Bills", kind: "expense" } })]);
    const settings = new Map([
      ["rent", { fixed: true, limit: 1200000 }],
      ["bills", { fixed: true, limit: null }],
      ["food", { fixed: false, limit: 600000 }],
    ]);
    expect(expectedFixed(settings, last)).toBe(1434156);
  });
});

describe("limitStatuses", () => {
  it("flags categories near (80%+) and over their limit, worst first", () => {
    const s = summarizeMonth("2026-10", [
      txn(-500000, "2026-10-03T02:00:00Z", { category: food }),
      txn(-110000, "2026-10-03T02:00:00Z", { category: { id: "fun", name: "Fun", kind: "expense" } }),
    ]);
    const settings = new Map([
      ["food", { fixed: false, limit: 600000 }],
      ["fun", { fixed: false, limit: 100000 }],
      ["health", { fixed: false, limit: 300000 }],
    ]);
    const names = new Map([["food", "Food"], ["fun", "Fun"], ["health", "Health"]]);
    expect(limitStatuses(s, settings, names).map((l) => [l.id, l.state])).toEqual([
      ["fun", "over"],
      ["food", "near"],
      ["health", "ok"],
    ]);
  });
});

describe("findRepeatCharges", () => {
  const netflix = (date: string, amount = 54900) => txn(-amount, `${date}T04:00:00Z`, { merchant: "NETFLIX.COM" });

  it("finds a monthly charge and predicts the next one", () => {
    const found = findRepeatCharges([netflix("2026-08-05"), netflix("2026-09-05"), netflix("2026-10-05")], "2026-10-12");
    expect(found).toEqual([{ merchant: "NETFLIX.COM", amount: 54900, last: "2026-10-05", next: "2026-11-05", times: 3, categoryId: null }]);
  });

  it("ignores frequent haunts, one-offs, different amounts and stopped subscriptions", () => {
    const coffee = Array.from({ length: 20 }, (_, i) => txn(-18000, `2026-09-${String(i + 1).padStart(2, "0")}T01:00:00Z`, { merchant: "Starbucks" }));
    expect(findRepeatCharges(coffee, "2026-10-12")).toEqual([]);
    expect(findRepeatCharges([netflix("2026-10-05")], "2026-10-12")).toEqual([]);
    expect(findRepeatCharges([netflix("2026-09-05", 20000), netflix("2026-10-05", 90000)], "2026-10-12")).toEqual([]);
    expect(findRepeatCharges([netflix("2026-05-05"), netflix("2026-06-05")], "2026-10-12")).toEqual([]);
  });
});

describe("safeToSpend", () => {
  it("is cash minus goal money minus dues, spread to payday", () => {
    const s = safeToSpend({ cash: 5000000, earmarked: 1000000, dues: 1500000, today: "2026-10-12", period: payPeriod("2026-10-12", [15, 31]) });
    expect(s.safe).toBe(2500000);
    expect(s.daysToPayday).toBe(3); // 12th, 13th, 14th
    expect(s.perDay).toBe(833333);
  });
});

describe("expectedFixed this month", () => {
  it("counts a fixed bill already paid this month even if last month had none", () => {
    const bills = { id: "bills", name: "Bills", kind: "expense" as const };
    const last = summarizeMonth("2026-09", []);
    const now = summarizeMonth("2026-10", [txn(-234156, "2026-10-10T02:00:00Z", { category: bills })]);
    expect(expectedFixed(new Map([["bills", { fixed: true, limit: null }]]), last, now)).toBe(234156);
  });
});
