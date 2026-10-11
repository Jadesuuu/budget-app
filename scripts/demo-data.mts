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

const DAY = 86_400_000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();
const manilaDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(now + offsetDays * DAY));

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
for (const table of ["accounts", "income_sources", "institutions", "categories", "raw_emails"] as const) {
  must(await db.from(table).delete().eq("user_id", uid).select("user_id"), `clear ${table}`);
}
must(await db.from("forwarding_sources").delete().eq("user_id", uid).neq("added_by", "account").select("user_id"), "clear forwarding sources");

const institutions = must(await db.from("institutions").select("id, slug").is("user_id", null), "institutions");
const inst = (slug: string) => {
  const found = institutions.find((i) => i.slug === slug);
  if (!found) throw new Error(`missing institution ${slug}`);
  return found.id;
};
const categories = must(await db.from("categories").select("id, name").is("user_id", null), "categories");
const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

// 3. Accounts (owed balances are negative)
const accountRows = must(
  await db
    .from("accounts")
    .insert([
      { user_id: uid, institution_id: inst("bpi"), type: "savings", name: "BPI Savings", last4: "7712", opening_balance_centavos: 4250000 },
      { user_id: uid, institution_id: inst("gcash"), type: "ewallet", name: "GCash", opening_balance_centavos: 482050 },
      { user_id: uid, institution_id: inst("maya"), type: "ewallet", name: "Maya Wallet", opening_balance_centavos: 125000 },
      { user_id: uid, institution_id: inst("bdo"), type: "savings", name: "BDO Savings", last4: "0921", opening_balance_centavos: 3840215 },
      { user_id: uid, institution_id: inst("bpi"), type: "credit", name: "BPI Credit", last4: "4417", opening_balance_centavos: -1845020 },
      { user_id: uid, institution_id: inst("eastwest"), type: "credit", name: "EastWest", last4: "8830", opening_balance_centavos: -620475 },
      { user_id: uid, institution_id: inst("atome"), type: "bnpl", name: "Atome", opening_balance_centavos: -199800 },
      { user_id: uid, institution_id: inst("bdo"), type: "loan", name: "BDO Personal Loan", opening_balance_centavos: -10000000 },
    ])
    .select("id, name"),
  "accounts",
);
const acct = (name: string) => accountRows.find((a) => a.name === name)!.id;

// 4. Cards, statements, loan, installment plan
must(
  await db.from("credit_cards").insert([
    { user_id: uid, account_id: acct("BPI Credit"), statement_day: 1, due_day: 21, credit_limit_centavos: 6000000, monthly_interest_bps: 300, min_payment_bps: 300, min_payment_floor_centavos: 50000 },
    { user_id: uid, account_id: acct("EastWest"), statement_day: 12, due_day: 2, credit_limit_centavos: 3500000, monthly_interest_bps: 300, min_payment_bps: 300, min_payment_floor_centavos: 50000 },
  ]).select("account_id"),
  "credit cards",
);
must(
  await db.from("statements").insert([
    { user_id: uid, account_id: acct("BPI Credit"), period_start: manilaDate(-37), period_end: manilaDate(-8), due_date: manilaDate(7), statement_balance_centavos: 1845020, minimum_due_centavos: 150000 },
    { user_id: uid, account_id: acct("EastWest"), period_start: manilaDate(-22), period_end: manilaDate(-1), due_date: manilaDate(22), statement_balance_centavos: 620475, minimum_due_centavos: 85000 },
  ]).select("id"),
  "statements",
);
must(
  await db.from("loans").insert({
    user_id: uid, account_id: acct("BDO Personal Loan"), principal_centavos: 10000000, monthly_rate_bps: 100,
    interest_method: "diminishing", term_months: 12, start_date: manilaDate(-20), first_due_date: manilaDate(10),
  }).select("id"),
  "loan",
);
must(
  await db.from("installment_plans").insert({
    user_id: uid, account_id: acct("Atome"), description: "Shopee order", total_centavos: 299700, installments: 3,
    frequency: "monthly", first_due_date: manilaDate(-19),
  }).select("id"),
  "installment plan",
);
// The first Atome payment is already paid.
must(
  await db.from("installment_payments").update({ paid_at: ago(19 * DAY) }).eq("user_id", uid).eq("seq", 1).select("id"),
  "mark first installment paid",
);

// 5. Transactions: a manual Meralco payment first, so the emailed one is flagged as its duplicate.
must(
  await db.from("transactions").insert({
    user_id: uid, account_id: acct("BDO Savings"), amount_centavos: -234156, occurred_at: ago(2 * DAY), merchant: "Meralco",
    category_id: cat("Bills"), status: "confirmed", source: "manual", confirmed_at: ago(2 * DAY),
  }).select("id"),
  "manual Meralco",
);
const pending = [
  { account: "BPI Credit", amount: -28900, at: ago(30 * 60_000), merchant: "Jollibee Katipunan", category: "Food", source: "email" },
  { account: "GCash", amount: 150000, at: ago(3 * 3_600_000), merchant: "Received from Carla M.", category: null, source: "email" },
  { account: "BPI Savings", amount: -500000, at: ago(5 * 3_600_000), merchant: "InstaPay to GCash", category: null, source: "email" },
  { account: "GCash", amount: 500000, at: ago(5 * 3_600_000 - 60_000), merchant: "Cash in from BPI", category: null, source: "email" },
  { account: "BDO Savings", amount: -234156, at: ago(DAY), merchant: "MERALCO", category: "Bills", source: "email" },
  { account: "Maya Wallet", amount: -18600, at: ago(DAY + 4 * 3_600_000), merchant: "Grab ride", category: "Transport", source: "email" },
  { account: "BDO Savings", amount: 2850000, at: ago(6 * 3_600_000), merchant: "Salary", category: "Salary", source: "recurring" },
] as const;
for (const t of pending) {
  must(
    await db.from("transactions").insert({
      user_id: uid, account_id: acct(t.account), amount_centavos: t.amount, occurred_at: t.at, merchant: t.merchant,
      category_id: t.category ? cat(t.category) : null, status: "pending", source: t.source,
    }).select("id"),
    `pending ${t.merchant}`,
  );
}

console.log(`Demo data ready for ${email}: ${accountRows.length} accounts, ${pending.length} transactions to review.`);
