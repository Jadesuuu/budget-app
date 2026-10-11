"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userDataChanged } from "@/lib/user-data";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MODE_COOKIE, THEME_COOKIE, modeSchema, themeIdSchema } from "@/lib/themes";

const YEAR = 60 * 60 * 24 * 365;

const appearanceSchema = z.object({ theme: themeIdSchema, mode: modeSchema });

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function saveAppearance(input: { theme: string; mode: string }): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That theme isn't available." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) return { ok: false, message: "Couldn't save your theme. Try again." };

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, parsed.data.theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  cookieStore.set(MODE_COOKIE, parsed.data.mode, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return { ok: true };
}

const nameSchema = z.object({ displayName: z.string().trim().max(80) });

export type NameState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function saveDisplayName(_prev: NameState, formData: FormData): Promise<NameState> {
  const parsed = nameSchema.safeParse({ displayName: String(formData.get("displayName") ?? "") });
  if (!parsed.success) return { status: "error", message: "Keep your name under 80 characters." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName || null })
    .eq("user_id", userId);
  if (error) return { status: "error", message: "Couldn't save your name. Try again." };
  userDataChanged();
  return { status: "saved" };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
