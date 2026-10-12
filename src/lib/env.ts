import "server-only";
import { z } from "zod";

// Values pasted into a hosting dashboard often carry stray spaces or newlines; trim them all.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().pipe(z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  INBOUND_EMAIL_DOMAIN: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "INBOUND_EMAIL_DOMAIN must be a bare domain like in.example.com"),
  ALLOWED_SIGNUP_EMAILS: z.string().default(""),
  // Server-only secrets for background jobs; optional so the app runs without them.
  SUPABASE_SECRET_KEY: z.string().trim().min(1).optional(),
  PARSE_JOB_SECRET: z.string().trim().min(24).optional(),
  // Web push; alerts are off without them.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().trim().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().trim().min(1).optional(),
  VAPID_SUBJECT: z.string().trim().regex(/^(mailto:|https:)/, "VAPID_SUBJECT must be a mailto: or https: URL").optional(),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  INBOUND_EMAIL_DOMAIN: process.env.INBOUND_EMAIL_DOMAIN,
  ALLOWED_SIGNUP_EMAILS: process.env.ALLOWED_SIGNUP_EMAILS,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  PARSE_JOB_SECRET: process.env.PARSE_JOB_SECRET,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
});

/** Only these addresses may create an account; existing users can always sign in. */
export const allowedSignupEmails = new Set(
  env.ALLOWED_SIGNUP_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
