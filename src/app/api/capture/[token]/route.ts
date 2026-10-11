import type { NextRequest } from "next/server";
import { handleCapture } from "@/lib/capture/handle";

/** Capture with the secret in the URL (SMS to URL Forwarder, iPhone shortcut). */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/capture/[token]">) {
  const { token } = await params;
  return handleCapture(request, token);
}
