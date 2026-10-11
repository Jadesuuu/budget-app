import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Data access layer entry point: verifies the session or redirects to /login. */
export async function requireUser() {
  // The session check reads the clock (token expiry), so it must run at request time, never in a prerender.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId, email };
}

export async function getProfile() {
  const { supabase, userId, email } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, theme, mode, inbound_alias")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return { ...data, userId, email };
}

export function initialsOf(name: string | null, email: string | null) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
