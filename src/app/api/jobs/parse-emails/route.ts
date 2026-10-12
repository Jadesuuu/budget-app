import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { processPendingMessages } from "@/lib/capture/run";
import { processPendingEmails } from "@/lib/email/run";
import { runNotifications } from "@/lib/notify/run";

/**
 * Called by the email Worker right after storing an email, and every 15 minutes by the Worker's schedule
 * as a safety net for anything left pending (emails and phone messages). Then sends any alerts that are due.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [emails, messages] = await Promise.all([processPendingEmails({ limit: 50 }), processPendingMessages({ limit: 100 })]);
  const alerts = await runNotifications().catch((e) => {
    console.error("notify failed", e);
    return { users: 0, sent: 0 };
  });
  return NextResponse.json({ emails, messages, alerts });
}

function authorized(header: string | null): boolean {
  const secret = env.PARSE_JOB_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
