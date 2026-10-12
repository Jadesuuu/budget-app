import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

/**
 * A short fingerprint of the user's data, polled while the app is open. When it changes (a text was captured,
 * something auto-confirmed, an import undone), the page refetches; otherwise nothing else is loaded.
 */
export async function GET() {
  const { supabase } = await requireUser();
  const [latestTx, txCount, latestMessage] = await Promise.all([
    supabase.from("transactions").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase.from("raw_messages").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (latestTx.error || txCount.error || latestMessage.error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const version = [latestTx.data?.updated_at ?? "", txCount.count ?? 0, latestMessage.data?.created_at ?? ""].join("|");
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
