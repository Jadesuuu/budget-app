import { describe, expect, it } from "vitest";
import { badgeFor, describeSource, describeWhen, findTransferPairs, type InboxItem } from "./inbox";

const NOW = new Date("2026-10-11T13:00:00Z"); // 9:00 PM in Manila

function item(over: Partial<InboxItem>): InboxItem {
  return {
    id: "x",
    accountId: "acct-bpi",
    accountName: "BPI Savings",
    accountLast4: null,
    institutionName: "BPI",
    amount: -100,
    occurredAt: "2026-10-11T12:42:00Z",
    merchant: null,
    source: "email",
    categoryId: null,
    duplicateOf: null,
    ...over,
  };
}

describe("describeWhen / describeSource", () => {
  it("shows the Manila time for today", () => {
    expect(describeWhen("2026-10-11T12:42:00Z", NOW)).toBe("8:42 PM");
  });
  it("says yesterday, then dates", () => {
    expect(describeWhen("2026-10-10T05:00:00Z", NOW)).toBe("yesterday");
    expect(describeWhen("2026-10-09T05:00:00Z", NOW)).toBe("Oct 9");
  });
  it("describes where a transaction came from", () => {
    expect(describeSource(item({}), NOW)).toBe("From BPI email, 8:42 PM");
    expect(describeSource(item({ source: "recurring", occurredAt: "2026-10-09T05:00:00Z" }), NOW)).toBe("Recurring, Oct 9");
  });
});

describe("badgeFor", () => {
  it("abbreviates institution names", () => {
    expect(badgeFor("BPI")).toBe("BPI");
    expect(badgeFor("GCash")).toBe("GC");
    expect(badgeFor("EastWest")).toBe("EW");
    expect(badgeFor("Atome")).toBe("AT");
    expect(badgeFor("RCBC")).toBe("RCBC");
    expect(badgeFor("Security Bank")).toBe("SB");
    expect(badgeFor("Coal & Brass Coop")).toBe("CBC");
  });
});

describe("findTransferPairs", () => {
  const out = item({ id: "out", amount: -500000, occurredAt: "2026-10-11T02:00:00Z" });
  const into = item({ id: "in", accountId: "acct-gcash", accountName: "GCash", amount: 500000, occurredAt: "2026-10-11T02:01:00Z" });

  it("pairs money out and the same amount in on another account", () => {
    expect(findTransferPairs([out, into])).toEqual([{ outId: "out", inId: "in", fromAccount: "BPI Savings", toAccount: "GCash" }]);
  });

  it("ignores same-account, different-amount and far-apart matches", () => {
    expect(findTransferPairs([out, { ...into, accountId: "acct-bpi" }])).toEqual([]);
    expect(findTransferPairs([out, { ...into, amount: 499000 }])).toEqual([]);
    expect(findTransferPairs([out, { ...into, occurredAt: "2026-10-12T03:00:00Z" }])).toEqual([]);
  });

  it("uses each transaction in at most one pair, closest first", () => {
    const laterIn = { ...into, id: "in-2", accountId: "acct-maya", accountName: "Maya", occurredAt: "2026-10-11T08:00:00Z" };
    expect(findTransferPairs([out, laterIn, into]).map((p) => p.inId)).toEqual(["in"]);
  });
});
