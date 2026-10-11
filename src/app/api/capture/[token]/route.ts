import { after, NextResponse, type NextRequest } from "next/server";
import { classifyCapture, messageInstitution } from "@/lib/capture/classify";
import { dedupeKey, readCapturePayload } from "@/lib/capture/payload";
import { loadCaptureInstitutions, processPendingMessages } from "@/lib/capture/run";
import { hashCaptureToken, isCaptureToken } from "@/lib/capture/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { redactCardNumbers } from "../../../../../shared/redact";

const MAX_REQUEST_BYTES = 16_000;

/**
 * Receives one bank SMS or app notification from the user's phone (Android forwarder app or iPhone shortcut).
 * The secret link is the credential. Messages from senders that aren't known banks are recorded without
 * their content, so personal texts and chats are never kept.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/capture/[token]">) {
  const { token } = await params;
  if (!isCaptureToken(token)) return notFound();

  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  // Full card numbers are masked before anything else happens; they are never stored.
  const msg = readCapturePayload(request.headers.get("content-type") ?? "", redactCardNumbers(raw));
  if (!msg) return NextResponse.json({ error: "no message text found" }, { status: 400 });

  const db = createAdminClient();
  const institutions = await loadCaptureInstitutions(db);
  const known = messageInstitution(msg, institutions) !== null;
  const flagNote = known ? null : (classifyCapture(msg, new Date().toISOString(), { institutions, accounts: [], parsers: [] }) as { note: string }).note;

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
    after(() => processPendingMessages({ userId, limit: 20 }).then(() => undefined));
  }
  return NextResponse.json({ status: known ? result.result : "ignored" });
}

/** Same reply for malformed and revoked links, so the endpoint reveals nothing about which links exist. */
function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
