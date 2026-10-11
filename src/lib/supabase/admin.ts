import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is only for background jobs (email parsing, cron), and every
 * write it makes must set user_id explicitly from data it already owns (CLAUDE.md).
 */
export function createAdminClient() {
  if (!env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
