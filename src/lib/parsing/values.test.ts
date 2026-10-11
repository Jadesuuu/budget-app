import { describe, expect, it } from "vitest";
import { manilaDateTime, monthDayYear, pesoAmount } from "./values";

describe("pesoAmount", () => {
  it.each([
    ["P130.83", 13083],
    ["P1,018.00", 101800],
    ["PHP 22,170.00", 2217000],
    ["PHP850.00", 85000],
    ["Php4,044.18", 404418],
    ["₱13885.00", 1388500],
    ["1000.00", 100000],
  ])("%s -> %i", (text, centavos) => expect(pesoAmount(text)).toBe(centavos));
  it("rejects non-amounts", () => expect(pesoAmount("Ref 12x")).toBeNull());
});

describe("manilaDateTime", () => {
  it.each([
    ["10-09-26 11:30:30 AM", "2026-10-09T11:30:30+08:00"],
    ["10-07-26 10:06PM", "2026-10-07T22:06:00+08:00"],
    ["10-08-26 12:05:00 AM", "2026-10-08T00:05:00+08:00"],
    ["06 October 2026, 10:56:31PM", "2026-10-06T22:56:31+08:00"],
    ["Sep 14 2026; 07:53:04 PM (GMT +8)", "2026-09-14T19:53:04+08:00"],
    ["Wednesday, Dec 17 2025; 04:05:59 AM(GMT + 8)", "2025-12-17T04:05:59+08:00"],
  ])("%s", (text, expected) => expect(manilaDateTime(text)).toBe(expected));
  it("returns null for unknown formats", () => expect(manilaDateTime("sometime yesterday")).toBeNull());
});

describe("monthDayYear", () => {
  it("reads receipt dates", () => {
    expect(monthDayYear("Date Aug 20, 2026 GCash")).toBe("2026-08-20");
    expect(monthDayYear("Sep 2, 2026")).toBe("2026-09-02");
  });
});
