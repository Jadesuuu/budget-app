import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { DEMO } from "@/lib/demo/mode";
import { env } from "@/lib/env";

/** Supabase client acting as the signed-in user, so RLS applies to every query. */
export async function createClient() {
  if (DEMO) return (await import("@/lib/demo/store")).createDemoClient();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called during Server Component render, where cookies are read-only.
          // The proxy refreshes the session on the next request.
        }
      },
    },
  });
}
