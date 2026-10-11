import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODE_COOKIE, THEME_COOKIE } from "@/lib/themes";

const YEAR = 60 * 60 * 24 * 365;

/** Magic-link landing: exchanges the one-time code for a session, then restores saved appearance. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const failed = NextResponse.redirect(new URL("/login?error=link", request.url));
  if (!code) return failed;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed;

  const response = NextResponse.redirect(new URL("/", request.url));
  const { data: profile } = await supabase.from("profiles").select("theme, mode").eq("user_id", data.user.id).single();
  if (profile) {
    response.cookies.set(THEME_COOKIE, profile.theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
    response.cookies.set(MODE_COOKIE, profile.mode, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
  return response;
}
