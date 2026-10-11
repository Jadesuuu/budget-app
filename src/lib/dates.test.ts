import { describe, expect, it } from "vitest";
import { addDays, dayAndMonth, daysBetween, relativeDue, todayInManila } from "./dates";

describe("dates", () => {
  it("uses the calendar day in Manila, not UTC", () => {
    // 2026-10-11 17:30 UTC is already 2026-10-12 01:30 in Manila (UTC+8).
    expect(todayInManila(new Date("2026-10-11T17:30:00Z"))).toBe("2026-10-12");
    expect(todayInManila(new Date("2026-10-11T15:59:00Z"))).toBe("2026-10-11");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-11", "2026-10-18")).toBe(7);
    expect(daysBetween("2026-10-11", "2026-10-10")).toBe(-1);
  });

  it("describes due dates relative to today", () => {
    expect(relativeDue("2026-10-11", "2026-10-11")).toBe("Due today");
    expect(relativeDue("2026-10-11", "2026-10-12")).toBe("Tomorrow");
    expect(relativeDue("2026-10-11", "2026-10-18")).toBe("In 7 days");
    expect(relativeDue("2026-10-11", "2026-10-10")).toBe("1 day late");
    expect(relativeDue("2026-10-11", "2026-10-08")).toBe("3 days late");
  });

  it("formats a due tile", () => {
    expect(dayAndMonth("2026-11-02")).toEqual({ day: "02", month: "Nov" });
  });
});
