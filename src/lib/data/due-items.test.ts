import { describe, expect, it } from "vitest";
import { mergeDueItems, type DueSources } from "./due-items";

const sources: DueSources = {
  statements: [
    { id: "s1", dueDate: "2026-10-18", balance: 1845020, minimumDue: 150000, paid: 0, accountName: "BPI Credit", last4: "4417" },
    { id: "s2", dueDate: "2026-10-20", balance: 500000, minimumDue: 50000, paid: 50000, accountName: "EastWest", last4: null },
    { id: "s3", dueDate: "2026-10-25", balance: 300000, minimumDue: 50000, paid: 20000, accountName: "Maya Credit", last4: null },
  ],
  loanPayments: [{ id: "l1", dueDate: "2026-11-01", amount: 888488, seq: 2, of: 12, name: "BDO Personal Loan" }],
  installmentPayments: [{ id: "i1", dueDate: "2026-10-10", amount: 33333, seq: 2, of: 3, name: "Shopee order" }],
};

describe("mergeDueItems", () => {
  it("sorts by due date and keeps a statement paid to its minimum as the rest to pay in full", () => {
    expect(mergeDueItems(sources).map((i) => i.key)).toEqual([
      "installment:i1",
      "statement:s1",
      "statement:s2",
      "statement:s3",
      "loan:l1",
    ]);
    const s2 = mergeDueItems(sources).find((i) => i.key === "statement:s2");
    expect(s2).toMatchObject({ amount: 450000, amountLabel: "Left to pay in full", minimumMet: true, minimumLeft: 0 });
  });

  it("drops a minimum-paid statement after its due date, and a fully paid one at once", () => {
    expect(mergeDueItems(sources, "2026-10-21").some((i) => i.key === "statement:s2")).toBe(false);
    const paid = { ...sources, statements: [{ ...sources.statements[0], paid: 1845020 }] };
    expect(mergeDueItems(paid).some((i) => i.key === "statement:s1")).toBe(false);
  });

  it("shows the remaining minimum on part-paid statements", () => {
    const s3 = mergeDueItems(sources).find((i) => i.key === "statement:s3");
    expect(s3).toMatchObject({ amount: 30000, amountLabel: "Minimum left" });
  });

  it("labels cards with their last four digits and payments with their position", () => {
    const items = mergeDueItems(sources);
    expect(items.find((i) => i.key === "statement:s1")?.name).toBe("BPI Credit ••4417");
    expect(items.find((i) => i.key === "loan:l1")?.detail).toBe("Payment 2 of 12");
  });
});

describe("fullAmount", () => {
  it("is a statement's unpaid balance, or the payment itself", () => {
    const items = mergeDueItems(sources);
    expect(items.find((i) => i.key === "statement:s3")?.fullAmount).toBe(280000);
    expect(items.find((i) => i.key === "loan:l1")?.fullAmount).toBe(888488);
  });
});
