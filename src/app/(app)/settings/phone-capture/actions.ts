"use server";

import { userDataChanged } from "@/lib/user-data";
import { z } from "zod";
import { siteOrigin } from "@/lib/site";
import { requireUser } from "@/lib/auth";
import { captureLinkLabelSchema } from "@/lib/capture/payload";
import { generateCaptureToken, hashCaptureToken } from "@/lib/capture/token";

export type CreateLinkState =
  | { status: "idle" }
  | { status: "created"; url: string; endpoint: string; token: string; label: string }
  | { status: "error"; message: string };

export async function createCaptureLink(_prev: CreateLinkState, formData: FormData): Promise<CreateLinkState> {
  const label = captureLinkLabelSchema.safeParse(formData.get("label"));
  if (!label.success) return { status: "error", message: label.error.issues[0].message };
  const { supabase } = await requireUser();
  const token = generateCaptureToken();
  const { error } = await supabase.from("capture_links").insert({ label: label.data, token_hash: hashCaptureToken(token) });
  if (error) return { status: "error", message: "Couldn't create the link. Try again." };
  const origin = await siteOrigin();
  userDataChanged();
  // The only time the secret leaves the server: it is not stored, only its hash is.
  return { status: "created", url: `${origin}/api/capture/${token}`, endpoint: `${origin}/api/capture`, token, label: label.data };
}

export async function revokeCaptureLink(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("capture_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  userDataChanged();
}
