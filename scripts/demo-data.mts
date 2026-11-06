// Local demo data for one user: accounts, a card statement, a loan, an Atome plan and a review inbox
// with a duplicate and a transfer pair. Replaces that user's existing data. Local database only.
//
//   pnpm demo                      -> jadesuuu@gmail.com
//   pnpm demo someone@example.com

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to write demo data to a non-local database: ${url}`);
}
if (!secret) throw new Error("SUPABASE_SECRET_KEY is missing from .env.local");

const email = (process.argv[2] ?? "jadesuuu@gmail.com").toLowerCase();
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || result.data === null) throw new Error(`${what}: ${result.error?.message ?? "no data"}`);
  return result.data;
}

import { seedDemoData } from "../src/lib/demo/seed.ts";


// 1. User
const listed = await db.auth.admin.listUsers({ perPage: 1000 });
if (listed.error) throw new Error(`list users: ${listed.error.message}`);
let user = listed.data.users.find((u) => u.email === email);
if (!user) {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`create user: ${created.error?.message ?? "no user"}`);
  user = created.data.user;
}
const uid = user.id;

// 2. Clear this user's data (accounts cascade to transactions, cards, statements, loans, plans).
for (const table of ["accounts", "income_sources", "institutions", "categories", "raw_emails", "raw_messages", "capture_links", "savings_goals", "category_settings", "push_subscriptions", "notification_log"] as const) {
  must(await db.from(table).delete().eq("user_id", uid).select("user_id"), `clear ${table}`);
}
must(await db.from("forwarding_sources").delete().eq("user_id", uid).neq("added_by", "account").select("user_id"), "clear forwarding sources");

const counts = await seedDemoData(db, uid);
console.log(
  `Demo data ready for ${email}: ${counts.accounts} accounts, ${counts.pending} transactions to review, ` +
    `${counts.history} past transactions, 2 savings goals.`,
);
