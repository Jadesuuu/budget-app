import { describe, expect, it } from "vitest";
import { centavosToInput, parsePesoInput } from "./money-input";

describe("parsePesoInput", () => {
  it.each([
    ["289", 28900],
    ["289.5", 28950],
    ["289.50", 28950],
    ["1,234.56", 123456],
    ["₱1,500", 150000],
    ["₱ 0.05", 5],
    ["PHP 2341.56", 234156],
    ["  10.  ", 1000],
  ])("parses %s as %i centavos", (input, expected) => {
    expect(parsePesoInput(input)).toBe(expected);
  });

  it("never goes through floating point", () => {
    // 0.1 + 0.2 style errors would show up here: 1.15 * 100 = 114.99999999999999 in floats.
    expect(parsePesoInput("1.15")).toBe(115);
    expect(parsePesoInput("4.35")).toBe(435);
  });

  it.each(["", "0", "0.00", "-5", "1.234", "abc", "1e5", "12,34x", "1000000001"])("rejects %s", (input) => {
    expect(parsePesoInput(input)).toBeNull();
  });
});

describe("centavosToInput", () => {
  it("round-trips", () => {
    expect(centavosToInput(123456)).toBe("1234.56");
    expect(centavosToInput(-28900)).toBe("289.00");
    expect(parsePesoInput(centavosToInput(5))).toBe(5);
  });
});
