import { describe, expect, it } from "vitest";
import { parseCsv, readBankCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("readBankCsv (synthetic layouts)", () => {
  it("reads Debit/Credit/Balance columns after a preamble", () => {
    const csv = [
      "Account,Savings ••5678",
      "",
      "Date,Description,Debit,Credit,Balance",
      '10/08/2026,Angkas,143.00,,"1,000.00"',
      '10/09/2026 11:30 AM,Salary,,"28,500.00","29,500.00"',
    ].join("\n");
    const result = readBankCsv(csv);
    expect(result).toEqual({
      skipped: 0,
      rows: [
        { occurredAt: "2026-10-08T12:00:00+08:00", amountCentavos: -14300, description: "Angkas", balanceAfterCentavos: 100000 },
        { occurredAt: "2026-10-09T11:30:00+08:00", amountCentavos: 2850000, description: "Salary", balanceAfterCentavos: 2950000 },
      ],
    });
  });

  it("reads a signed Amount column with parentheses or minus for money out", () => {
    const result = readBankCsv("Transaction Date,Details,Amount\n2026-10-08,Coffee,(150.00)\n2026-10-09,Refund,50.00\n2026-10-10,Fee,-10.00");
    expect("rows" in result && result.rows.map((r) => r.amountCentavos)).toEqual([-15000, 5000, -1000]);
  });

  it("explains what's wrong with unusable files", () => {
    expect(readBankCsv("foo,bar\n1,2")).toEqual({ error: "Couldn't find a Date column in this CSV." });
    expect(readBankCsv("Date,Description\n2026-10-08,x")).toEqual({ error: "Couldn't find Amount or Debit/Credit columns in this CSV." });
  });
});
