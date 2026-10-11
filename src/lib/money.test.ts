import { describe, expect, it } from "vitest";
import { formatPeso } from "./money";

describe("formatPeso", () => {
  it("formats centavos with thousands separators", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
  });
  it("pads cents", () => {
    expect(formatPeso(28900)).toBe("₱289.00");
    expect(formatPeso(5)).toBe("₱0.05");
  });
  it("uses a true minus for negatives and + when signed", () => {
    expect(formatPeso(-28900)).toBe("−₱289.00");
    expect(formatPeso(150000, { signed: true })).toBe("+₱1,500.00");
    expect(formatPeso(0, { signed: true })).toBe("₱0.00");
  });
  it("rejects non-integer amounts", () => {
    expect(() => formatPeso(12.5)).toThrow();
  });
});
