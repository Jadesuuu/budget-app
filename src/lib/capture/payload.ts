import { z } from "zod";
import { redactCardNumbers } from "../../../shared/redact";
import { sha256Hex } from "./token";

/** A captured SMS or app notification, whatever app or shortcut sent it. */
export type CapturedMessage = {
  channel: "sms" | "notification";
  sender: string;
  title: string | null;
  body: string;
  /** ISO time the phone received it; null when the sender didn't say. */
  receivedAt: string | null;
};

const MAX_BODY = 4000;

// Field names used by common forwarder apps (SMS to URL Forwarder, Message487) and by our iPhone shortcut.
// Message487: SMS has "sender" (source is "android"); notifications have "source" = the app package.
const SENDER_KEYS = ["from", "sender", "address", "app", "package", "packageName", "appName", "source"];
const BODY_KEYS = ["text", "body", "message", "content", "msg"];
const TITLE_KEYS = ["title", "subject"];
const TIME_KEYS = ["receivedStamp", "receivedAt", "received_at", "occurred_at", "occurredAt", "timestamp", "time", "date", "sentStamp"];

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
};

/** Accepts JSON, form-encoded or plain text. Returns null when there is no usable message. */
export function readCapturePayload(contentType: string, raw: string): CapturedMessage | null {
  let fields: Record<string, unknown> = {};
  const type = contentType.toLowerCase();
  if (type.includes("json") || raw.trimStart().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fields = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (type.includes("x-www-form-urlencoded")) {
    fields = Object.fromEntries(new URLSearchParams(raw));
  } else {
    fields = { text: raw };
  }

  const body = pick(fields, BODY_KEYS);
  if (!body) return null;
  const sender = pick(fields, SENDER_KEYS) ?? "unknown";
  const declared = fields.channel ?? fields.message_type ?? fields.messageType;
  const explicitChannel = typeof declared === "string" ? declared.toLowerCase() : null;
  const looksLikeApp = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(sender); // e.g. com.globe.gcash.android
  const channel = explicitChannel === "notification" || (explicitChannel !== "sms" && looksLikeApp) ? "notification" : "sms";

  return {
    channel,
    sender: sender.slice(0, 200),
    title: pick(fields, TITLE_KEYS)?.slice(0, 300) ?? null,
    body: body.slice(0, MAX_BODY),
    receivedAt: toIso(pick(fields, TIME_KEYS)),
  };
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const asNumber = Number(value);
  const ms = Number.isFinite(asNumber) ? (asNumber < 1e12 ? asNumber * 1000 : asNumber) : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const year = new Date(ms).getUTCFullYear();
  return year >= 2020 && year <= 2100 ? new Date(ms).toISOString() : null;
}

/**
 * Same message retried by the phone app -> same key. With a phone timestamp the key is exact; without one
 * it is bucketed by hour, so a retry minutes later still matches but a genuine repeat tomorrow does not.
 */
export function dedupeKey(msg: CapturedMessage, now: Date = new Date()): string {
  const when = msg.receivedAt ?? new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
  return sha256Hex([msg.channel, msg.sender.toLowerCase(), msg.title ?? "", msg.body, when].join("\u0000"));
}

export const captureLinkLabelSchema = z.string().trim().min(1, "Give this link a name, like My Android.").max(60);

/**
 * Reads a capture request and masks full card numbers in its text fields. Parsing comes first: masking the raw
 * request would corrupt numeric fields such as 13-digit timestamps that happen to pass the card checksum.
 */
export function readCaptureMessage(contentType: string, raw: string): CapturedMessage | null {
  const msg = readCapturePayload(contentType, raw);
  if (!msg) return null;
  return {
    ...msg,
    sender: redactCardNumbers(msg.sender),
    title: msg.title === null ? null : redactCardNumbers(msg.title),
    body: redactCardNumbers(msg.body),
  };
}
