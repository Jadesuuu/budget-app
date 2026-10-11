import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  INBOUND_EMAIL_DOMAIN: z.string().min(3),
  ALLOWED_SIGNUP_EMAILS: z.string().default(""),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  INBOUND_EMAIL_DOMAIN: process.env.INBOUND_EMAIL_DOMAIN,
  ALLOWED_SIGNUP_EMAILS: process.env.ALLOWED_SIGNUP_EMAILS,
});

/** Only these addresses may create an account; existing users can always sign in. */
export const allowedSignupEmails = new Set(
  env.ALLOWED_SIGNUP_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
