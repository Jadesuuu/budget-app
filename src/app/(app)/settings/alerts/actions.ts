"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { pushConfigured, sendPush } from "@/lib/notify/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { userDataChanged } from "@/lib/user-data";

export type AlertResult = { ok: true } | { ok: false; message: string };

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  device: z.string().max(120).optional(),
});

/** Saves this browser's push subscription (from PushManager.subscribe) for the signed-in user. */
export async function saveSubscription(input: unknown): Promise<AlertResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This browser sent an unexpected subscription." };
  const { supabase } = await requireUser();
  // Re-subscribing the same browser replaces its old row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device: parsed.data.device ?? null,
  });
  if (error) return { ok: false, message: "Couldn't turn on alerts. If someone else used Budget in this browser, they need to turn alerts off first." };
  userDataChanged();
  return { ok: true };
}

export async function deleteSubscription(endpoint: string): Promise<AlertResult> {
  const parsed = z.url().safeParse(endpoint);
  if (!parsed.success) return { ok: false, message: "Unknown device." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data);
  if (error) return { ok: false, message: "Couldn't turn off alerts. Try again." };
  userDataChanged();
  return { ok: true };
}

export async function saveAlertPrefs(prefs: { bills: boolean; spending: boolean }): Promise<AlertResult> {
  const parsed = z.object({ bills: z.boolean(), spending: z.boolean() }).safeParse(prefs);
  if (!parsed.success) return { ok: false, message: "Something went wrong." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ notify_bills: parsed.data.bills, notify_spending: parsed.data.spending })
    .eq("user_id", userId);
  if (error) return { ok: false, message: "Couldn't save. Try again." };
  userDataChanged();
  return { ok: true };
}

/** Sends a test alert to every device the user turned on. */
export async function sendTestAlert(): Promise<AlertResult> {
  if (!pushConfigured()) return { ok: false, message: "Alerts aren't set up on this server yet." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error || !data.length) return { ok: false, message: "No devices have alerts turned on." };
  // Sending only touches the user's own rows (read above under RLS); admin is used to drop dead devices.
  const sent = await sendPush(createAdminClient(), data, {
    title: "Budget alerts are on",
    body: "You'll hear about bills due and when today's spending runs out.",
    url: "/",
    ref: "test",
  });
  return sent > 0 ? { ok: true } : { ok: false, message: "The push service didn't accept it. Turn alerts off and on again." };
}
