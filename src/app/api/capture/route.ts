import type { NextRequest } from "next/server";
import { bearerToken, handleCapture } from "@/lib/capture/handle";

/** Capture with the secret as a Bearer token (Message487 and other apps that keep URL and token separate). */
export async function POST(request: NextRequest) {
  return handleCapture(request, bearerToken(request));
}
