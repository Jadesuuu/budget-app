import { describe, expect, it } from "vitest";
import { classifyCapture, normalizeSmsSender, type CaptureContext } from "./classify";
import { dedupeKey, readCaptureMessage, readCapturePayload, type CapturedMessage, readEventId } from "./payload";
import type { MessageParser } from "./parsers";
import { generateCaptureToken, hashCaptureToken, isCaptureToken } from "./token";

describe("capture tokens", () => {
  it("are long, random and only stored as a hash", () => {
    const a = generateCaptureToken();
    const b = generateCaptureToken();
    expect(isCaptureToken(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(hashCaptureToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCaptureToken(a)).toBe(hashCaptureToken(a));
    expect(isCaptureToken("cap_short")).toBe(false);
  });
});

describe("readCapturePayload", () => {
  it("reads an SMS forwarder's JSON (from/text/receivedStamp in ms)", () => {
    const msg = readCapturePayload("application/json", JSON.stringify({ from: "BPI", text: "Hello", receivedStamp: 1791720000000 }));
    expect(msg).toEqual({ channel: "sms", sender: "BPI", title: null, body: "Hello", receivedAt: "2026-10-11T12:00:00.000Z" });
  });

  it("treats an Android package name as an app notification", () => {
    const msg = readCapturePayload("application/json", JSON.stringify({ package: "com.globe.gcash.android", title: "GCash", text: "Received" }));
    expect(msg).toMatchObject({ channel: "notification", sender: "com.globe.gcash.android", title: "GCash" });
  });

  it("reads Message487 SMS events (sender + source=android)", () => {
    const msg = readCapturePayload(
      "application/json",
      JSON.stringify({ schema_version: 1, event_id: "e1", message_type: "sms", source: "android", source_name: "Android", sender: "GCash", text: "Paid", occurred_at: "2026-10-11T04:00:00Z" }),
    );
    expect(msg).toEqual({ channel: "sms", sender: "GCash", title: null, body: "Paid", receivedAt: "2026-10-11T04:00:00.000Z" });
  });

  it("finds Message487's event_id so the reply can confirm it", () => {
    expect(readEventId("application/json", JSON.stringify({ event_id: "evt-1a2b:3", text: "x" }))).toBe("evt-1a2b:3");
    expect(readEventId("application/json", JSON.stringify({ text: "x" }))).toBeNull();
    expect(readEventId("application/json", JSON.stringify({ event_id: "<script>" }))).toBeNull();
    expect(readEventId("text/plain", "event_id=1")).toBeNull();
  });

  it("reads Message487 notification events (source = app package)", () => {
    const msg = readCapturePayload(
      "application/json",
      JSON.stringify({ message_type: "notification", source: "com.viber.voip", source_name: "Viber", title: "Atome", text: "Your bill is due", occurred_at: "2026-10-11T04:00:00Z" }),
    );
    expect(msg).toMatchObject({ channel: "notification", sender: "com.viber.voip", title: "Atome" });
  });

  it("reads the iPhone shortcut's JSON, which names the channel", () => {
    const msg = readCapturePayload("application/json", JSON.stringify({ channel: "sms", sender: "EastWest", message: "Txn" }));
    expect(msg).toMatchObject({ channel: "sms", sender: "EastWest", body: "Txn", receivedAt: null });
  });

  it("accepts form posts and plain text", () => {
    expect(readCapturePayload("application/x-www-form-urlencoded", "from=BPI&text=Hi%20there")?.body).toBe("Hi there");
    expect(readCapturePayload("text/plain", "just the text")).toMatchObject({ sender: "unknown", body: "just the text" });
  });

  it("rejects empty or broken payloads and silly timestamps", () => {
    expect(readCapturePayload("application/json", "{")).toBeNull();
    expect(readCapturePayload("application/json", JSON.stringify({ from: "BPI" }))).toBeNull();
    expect(readCapturePayload("application/json", JSON.stringify({ text: "x", time: "1999-01-01" }))?.receivedAt).toBeNull();
  });
});

describe("dedupeKey", () => {
  const msg: CapturedMessage = { channel: "sms", sender: "BPI", title: null, body: "PHP 289.00", receivedAt: null };
  it("matches retries within the hour when the phone gives no time", () => {
    expect(dedupeKey(msg, new Date("2026-10-11T12:05:00Z"))).toBe(dedupeKey(msg, new Date("2026-10-11T12:55:00Z")));
    expect(dedupeKey(msg, new Date("2026-10-11T12:05:00Z"))).not.toBe(dedupeKey(msg, new Date("2026-10-12T12:05:00Z")));
  });
  it("uses the phone's time when given", () => {
    const a = { ...msg, receivedAt: "2026-10-11T12:00:00.000Z" };
    expect(dedupeKey(a, new Date("2026-10-11T12:00:00Z"))).toBe(dedupeKey(a, new Date("2026-10-13T00:00:00Z")));
  });
});

describe("classifyCapture", () => {
  // Synthetic parser for a made-up bank; real parsers come from real samples.
  const parser: MessageParser = {
    id: "testbank.sms",
    version: 1,
    institution: "testbank",
    matches: (m) => m.body.includes("TESTBANK"),
    parse: (m, receivedAt) => {
      const amount = /PHP ([\d,]+)\.(\d{2})/.exec(m.body);
      if (!amount) return null;
      return {
        amountCentavos: -(Number(amount[1].replace(/,/g, "")) * 100 + Number(amount[2])),
        occurredAt: receivedAt,
        merchant: /at (.+?)\./.exec(m.body)?.[1] ?? null,
        last4: /ending (\d{4})/.exec(m.body)?.[1] ?? null,
        accountType: null,
      };
    },
  };
  const ctx: CaptureContext = {
    institutions: [{ id: "inst-tb", slug: "testbank", name: "Test Bank", smsSenders: ["TestBank"], appPackages: ["com.testbank.app"] }],
    accounts: [{ id: "acct-1", institutionId: "inst-tb", type: "credit", last4: "4417", archived: false }],
    parsers: [parser],
  };
  const sms: CapturedMessage = {
    channel: "sms",
    sender: "TEST-BANK",
    title: null,
    body: "TESTBANK: Card ending 4417 used for PHP 1,289.50 at JOLLIBEE.",
    receivedAt: null,
  };

  it("matches SMS sender IDs regardless of case and punctuation", () => {
    expect(normalizeSmsSender("Test-Bank")).toBe("TESTBANK");
    expect(classifyCapture(sms, "2026-10-11T12:42:00.000Z", ctx)).toMatchObject({
      kind: "transaction",
      accountId: "acct-1",
      transaction: { amountCentavos: -128950, merchant: "JOLLIBEE", last4: "4417" },
    });
  });

  it("holds back texts and apps that aren't known banks", () => {
    expect(classifyCapture({ ...sms, sender: "Mama" }, "2026-10-11T12:42:00.000Z", ctx)).toEqual({
      kind: "flagged",
      note: "Texts from Mama aren't from a known bank or e-wallet.",
    });
    expect(classifyCapture({ ...sms, channel: "notification", sender: "com.whatsapp" }, "2026-10-11T12:42:00.000Z", ctx).kind).toBe("flagged");
  });

  it("matches Viber business chats by chat name and holds back personal chats", () => {
    const viber = { ...sms, channel: "notification" as const, sender: "com.viber.voip", title: "TestBank" };
    expect(classifyCapture(viber, "2026-10-11T12:42:00.000Z", ctx).kind).toBe("transaction");
    expect(classifyCapture({ ...viber, title: "Barkada GC" }, "2026-10-11T12:42:00.000Z", ctx)).toEqual({
      kind: "flagged",
      note: "Chats from Barkada GC aren't from a known bank or e-wallet.",
    });
  });

  it("keeps known-bank messages with no parser yet", () => {
    expect(classifyCapture(sms, "2026-10-11T12:42:00.000Z", { ...ctx, parsers: [] })).toEqual({
      kind: "failed",
      note: "No reader for this Test Bank message yet.",
    });
  });
});

describe("timestamps that look like card numbers", () => {
  it("reads 13-digit millisecond timestamps that happen to pass the card checksum", () => {
    // 1791720001000 passes the Luhn check, like roughly 1 in 10 real timestamps.
    const raw = JSON.stringify({ from: "BPI", text: "Card 4111111111111111 used", receivedStamp: 1791720001000 });
    const msg = readCaptureMessage("application/json", raw);
    expect(msg?.receivedAt).toBe("2026-10-11T12:00:01.000Z");
    expect(msg?.body).toBe("Card ************1111 used");
  });
});
