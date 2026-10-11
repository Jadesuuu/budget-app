import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyCapture, type CaptureContext } from "../classify";
import type { CapturedMessage } from "../payload";
import { MESSAGE_PARSERS } from "./index";

type Fixture = { name: string; sender: string; body: string; expect?: Record<string, unknown>; expectStatement?: Record<string, unknown> };
const load = (file: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures/messages", file), "utf8")) as Fixture[];

const ctx: CaptureContext = {
  institutions: [
    { id: "i-gcash", slug: "gcash", name: "GCash", smsSenders: ["GCash"], appPackages: ["com.globe.gcash.android"] },
    { id: "i-bpi", slug: "bpi", name: "BPI", smsSenders: ["BPI"], appPackages: [] },
  ],
  accounts: [
    { id: "acct-gcash", institutionId: "i-gcash", type: "ewallet", last4: null, archived: false },
    { id: "acct-bpi", institutionId: "i-bpi", type: "savings", last4: "5678", archived: false },
    { id: "acct-bpi-credit", institutionId: "i-bpi", type: "credit", last4: "9999", archived: false },
  ],
  parsers: MESSAGE_PARSERS,
};
const RECEIVED = "2026-10-11T00:00:00.000Z";
const sms = (f: Fixture): CapturedMessage => ({ channel: "sms", sender: f.sender, title: null, body: f.body, receivedAt: RECEIVED });

describe.each([
  ["gcash-sms.json", "acct-gcash"],
  ["bpi-sms.json", "acct-bpi"],
])("%s (real, redacted samples)", (file, accountId) => {
  for (const fixture of load(file)) {
    it(fixture.name, () => {
      const outcome = classifyCapture(sms(fixture), RECEIVED, ctx);
      if (fixture.expect) {
        expect(outcome).toMatchObject({ kind: "transaction", accountId, transaction: fixture.expect });
      } else {
        expect(outcome).toMatchObject({ kind: "statement", accountId: "acct-bpi-credit", statement: fixture.expectStatement });
      }
    });
  }
});

describe("GCash on Viber or as an app notification", () => {
  const [paid] = load("gcash-sms.json");
  it("reads the same text from the GCash app notification", () => {
    const notification: CapturedMessage = { ...sms(paid), channel: "notification", sender: "com.globe.gcash.android", title: "GCash" };
    expect(classifyCapture(notification, RECEIVED, ctx)).toMatchObject({ kind: "transaction", transaction: { amountCentavos: -13083 } });
  });
  it("reads it from a Viber business chat named GCash", () => {
    const viber: CapturedMessage = { ...sms(paid), channel: "notification", sender: "com.viber.voip", title: "GCash" };
    expect(classifyCapture(viber, RECEIVED, ctx)).toMatchObject({ kind: "transaction", transaction: { merchant: "FFT*PINDUOD" } });
  });
});
