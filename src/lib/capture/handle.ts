import "server-only";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyCapture, isOneTimeCode, messageInstitution } from "./classify";
import { dedupeKey, readCaptureMessage, readEventId } from "./payload";
import { loadCaptureInstitutions, processPendingMessages } from "./run";
import { hashCaptureToken, isCaptureToken } from "./token";
import { runNotifications } from "@/lib/notify/run";

const MAX_REQUEST_BYTES = 16_000;

/**
 * Receives one bank SMS or app notification from the user's phone (Android forwarder app or iPhone shortcut).
 * The capture secret is the credential, sent in the URL or as a Bearer token. Messages from senders that
 * aren't known banks are recorded without their content, so personal texts and chats are never kept.
 */
export async function handleCapture(request: Request, token: string | null): Promise<Response> {
  if (!token || !isCaptureToken(token)) return notFound();

  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  const contentType = request.headers.get("content-type") ?? "";
  const eventId = readEventId(contentType, raw);
  const msg = readCaptureMessage(contentType, raw);
  if (!msg) {
    // A forwarder's connection test may carry no text; acknowledge it so the app reports success, store nothing.
    if (eventId) return NextResponse.json({ status: "accepted", event_id: eventId, result: "empty" });
    return NextResponse.json({ error: "no message text found" }, { status: 400 });
  }

  const db = createAdminClient();
  const institutions = await loadCaptureInstitutions(db);
  const fromKnown = messageInstitution(msg, institutions) !== null;
  const code = fromKnown && isOneTimeCode(msg);
  const known = fromKnown && !code;
  const flagNote = known
    ? null
    : code
      ? "Verification codes aren't kept."
      : (classifyCapture(msg, new Date().toISOString(), { institutions, accounts: [], parsers: [] }) as { note: string }).note;

  const { data, error } = await db.rpc("capture_message", {
    p_token_hash: hashCaptureToken(token),
    p_channel: msg.channel,
    p_sender: msg.sender,
    p_title: msg.title ?? "",
    p_body: msg.body,
    p_received_at: msg.receivedAt ?? new Date().toISOString(),
    p_dedupe_key: dedupeKey(msg),
    p_flag_note: flagNote ?? undefined,
  });
  if (error) return NextResponse.json({ error: "could not store" }, { status: 500 });
  const result = data[0];
  if (!result || result.result === "invalid_link") return notFound();

  if (result.result === "stored" && known && result.user_id) {
    const userId = result.user_id;
    // Read it, then alert right away if it pushed today over (instead of waiting for the next scheduled run).
    after(() =>
      processPendingMessages({ userId, limit: 20 })
        .then(() => runNotifications({ userId }))
        .then(() => undefined),
    );
  }
  const status = known ? result.result : "ignored";
  // Message487 wants its event echoed back as accepted; "result" keeps what Budget did with it.
  return NextResponse.json(eventId ? { status: "accepted", event_id: eventId, result: status } : { status });
}

/** "Authorization: Bearer cap_..." -> the token, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? null;
}

/** Same reply for malformed and revoked secrets, so the endpoint reveals nothing about which ones exist. */
function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
