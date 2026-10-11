import { describe, expect, it } from "vitest";
import { closingBalance, matchImport, type ExistingTransaction, type ImportRow } from "./match";

const row = (over: Partial<ImportRow>): ImportRow => ({ occurredAt: "2026-10-08T10:00:00+08:00", amountCentavos: -14300, description: "Angkas", ...over });
const tx = (over: Partial<ExistingTransaction>): ExistingTransaction => ({
  id: "t1",
  occurredAt: "2026-10-08T18:55:46+08:00",
  amountCentavos: -14300,
  merchant: "Angkas",
  status: "pending",
  ...over,
});

describe("matchImport", () => {
  it("matches the same amount within two days even when the times differ", () => {
    const result = matchImport([row({})], [tx({})]);
    expect(result.matched).toHaveLength(1);
    expect(result.missing).toEqual([]);
  });

  it("adds what Budget doesn't have and flags what the file doesn't list", () => {
    const result = matchImport(
      [row({}), row({ occurredAt: "2026-10-09T09:00:00+08:00", amountCentavos: -25000, description: "Missed one" })],
      [tx({}), tx({ id: "t2", occurredAt: "2026-10-08T20:00:00+08:00", amountCentavos: -999, merchant: "Typed twice?" })],
    );
    expect(result.missing.map((r) => r.description)).toEqual(["Missed one"]);
    expect(result.notInFile.map((t) => t.id)).toEqual(["t2"]);
  });

  it("pairs two identical purchases one-to-one, closest in time first", () => {
    const result = matchImport(
      [row({ occurredAt: "2026-10-08T08:00:00+08:00" }), row({ occurredAt: "2026-10-08T19:00:00+08:00" })],
      [tx({ id: "morning", occurredAt: "2026-10-08T08:05:00+08:00" })],
    );
    expect(result.matched).toEqual([{ row: expect.objectContaining({ occurredAt: "2026-10-08T08:00:00+08:00" }), existingId: "morning" }]);
    expect(result.missing).toHaveLength(1);
  });

  it("ignores matches more than two days apart and transactions outside the file's dates", () => {
    const result = matchImport([row({})], [tx({ occurredAt: "2026-10-12T10:00:00+08:00" })]);
    expect(result.matched).toEqual([]);
    expect(result.notInFile).toEqual([]);
  });
});

describe("closingBalance", () => {
  it("uses the latest row that shows a balance", () => {
    expect(
      closingBalance([
        row({ occurredAt: "2026-10-09T11:30:30+08:00", balanceAfterCentavos: 86455 }),
        row({ occurredAt: "2026-10-08T19:41:00+08:00", balanceAfterCentavos: 99538 }),
        row({ occurredAt: "2026-10-10T08:00:00+08:00", balanceAfterCentavos: null }),
      ]),
    ).toEqual({ balanceCentavos: 86455, asOf: "2026-10-09T11:30:30+08:00" });
    expect(closingBalance([row({})])).toBeNull();
  });
});
