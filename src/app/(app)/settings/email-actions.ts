"use server";

import { userDataChanged } from "@/lib/user-data";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { processPendingEmails } from "@/lib/email/run";
import { createAdminClient } from "@/lib/supabase/admin";

export type SourceState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function addForwardingSource(_prev: SourceState, formData: FormData): Promise<SourceState> {
  const parsed = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { status: "error", message: "Enter a full email address, like you@gmail.com." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("forwarding_sources").insert({ email: parsed.data });
  if (error) {
    return { status: "error", message: error.code === "23505" ? "That address is already on your list." : "Couldn't add that address." };
  }
  userDataChanged();
  return { status: "saved" };
}

export async function removeForwardingSource(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase } = await requireUser();
  const { error } = await supabase.from("forwarding_sources").delete().eq("id", id).neq("added_by", "account");
  if (error) throw error;
  userDataChanged();
}

/** Re-queue one of the user's own emails (after adding an account or address) and parse it now. */
export async function retryEmail(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { supabase, userId } = await requireUser();
  // RLS proves ownership; the admin client then only touches this one row.
  const { data, error } = await supabase.from("raw_emails").select("id").eq("id", id).in("status", ["failed", "flagged"]).maybeSingle();
  if (error) throw error;
  if (!data) return;
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("raw_emails")
    .update({ status: "pending", note: null })
    .eq("id", data.id)
    .eq("user_id", userId);
  if (updateError) throw updateError;
  await processPendingEmails({ userId, limit: 10 });
  userDataChanged();
}
