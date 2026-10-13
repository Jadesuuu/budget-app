import { describe, expect, it } from "vitest";
import type { DueItem } from "@/lib/data/due-items";
import { allowance } from "@/lib/spending";
import { computeAlerts, type AlertInput } from "./alerts";

const bill = (dueDate: string): DueItem => ({
  key: "statement:s1",
  kind: "statement",
  name: "BPI Credit ••4417",
  detail: "",
  dueDate,
  amount: 150000,
  amountLabel: "Minimum",
  amountKnown: true,
  fullAmount: 1845020,
  minimumMet: false,
  minimumLeft: 150000,
});

const base: AlertInput = {
  today: "2026-10-12",
  hour: 9,
  prefs: { bills: true, spending: true },
  due: [],
  allowance: null,
  limits: [],
};

describe("computeAlerts", () => {
  it("announces bills 3 days and 1 day before, on the day, and one day late", () => {
    const refs = ["2026-10-15", "2026-10-14", "2026-10-13", "2026-10-12", "2026-10-11", "2026-10-10"].map(
      (d) => computeAlerts({ ...base, due: [bill(d)] }).map((a) => a.ref)[0] ?? null,
    );
    expect(refs).toEqual(["statement:s1:3", null, "statement:s1:1", "statement:s1:0", "statement:s1:-1", null]);
    const [tomorrow] = computeAlerts({ ...base, due: [bill("2026-10-13")] });
    expect(tomorrow.title).toBe("BPI Credit ••4417: due tomorrow");
    expect(tomorrow.body).toBe("Minimum ₱1,500.00, ₱18,450.20 to pay in full.");
  });

  it("warns once a day when today's amount is used up, and about category limits once a month", () => {
    const over = allowance(3100000, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200000, ...Array(19).fill(0)], 11);
    const alerts = computeAlerts({
      ...base,
      allowance: over,
      limits: [
        { id: "food", name: "Food", spent: 500000, limit: 600000, state: "near" },
        { id: "fun", name: "Fun", spent: 50000, limit: 600000, state: "ok" },
      ],
    });
    expect(alerts.map((a) => a.ref)).toEqual(["2026-10-12", "near:food:2026-10"]);
    expect(alerts[0].title).toBe("₱450.00 over today's amount");
  });

  it("doesn't nag about a card whose minimum is already paid", () => {
    expect(computeAlerts({ ...base, due: [{ ...bill("2026-10-13"), minimumMet: true, minimumLeft: 0 }] })).toEqual([]);
  });

  it("stays quiet at night and respects the user's choices", () => {
    expect(computeAlerts({ ...base, hour: 23, due: [bill("2026-10-12")] })).toEqual([]);
    expect(computeAlerts({ ...base, hour: 6, due: [bill("2026-10-12")] })).toEqual([]);
    expect(computeAlerts({ ...base, prefs: { bills: false, spending: true }, due: [bill("2026-10-12")] })).toEqual([]);
  });
});
