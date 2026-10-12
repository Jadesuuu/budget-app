import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Data access layer entry point for pages: verifies the session or redirects to /login.
 * Call it only inside a `"use cache: private"` component or function, which runs at request time and
 * lets the router prefetch the result per user. Wrapped in React cache: one check per render.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId, email };
});

/** Same check for Server Actions and Route Handlers, which always run at request time. */
export async function requireUser() {
  // The session check reads the clock (token expiry), so it must never run in a prerender.
  await connection();
  return getSession();
}

export const getProfile = cache(async () => {
  const { supabase, userId, email } = await getSession();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, theme, mode, inbound_alias, monthly_income_centavos, spending_limit_centavos, paydays, notify_bills, notify_spending")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return { ...data, userId, email };
});

export function initialsOf(name: string | null, email: string | null) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
