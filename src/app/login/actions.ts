"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { allowedSignupEmails } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const loginSchema = z.object({ email: z.email().max(254) });

// Errors that only mean "this address can't sign up"; reporting them would reveal who has an account.
const SILENT_ERROR_CODES = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: String(formData.get("email") ?? "").trim() });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };

  const email = parsed.data.email.toLowerCase();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: allowedSignupEmails.has(email), emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error?.status === 429) {
    return { status: "error", message: "Too many sign-in emails. Wait a minute, then try again." };
  }
  if (error && !SILENT_ERROR_CODES.has(error.code ?? "")) {
    return { status: "error", message: "We couldn't send the sign-in email. Try again in a moment." };
  }
  return { status: "sent", email };
}
