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
for (const table of ["accounts", "income_sources", "institutions", "categories", "raw_emails", "raw_messages", "capture_links", "savings_goals", "category_settings", "push_subscriptions", "notification_log"] as const) {
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
      { user_id: uid, institution_id: inst("bpi"), type: "savings", name: "BPI Savings", last4: "5678", opening_balance_centavos: 4250000 },
      { user_id: uid, institution_id: inst("gcash"), type: "ewallet", name: "GCash", opening_balance_centavos: 482050 },
      { user_id: uid, institution_id: inst("maya"), type: "ewallet", name: "Maya Wallet", opening_balance_centavos: 125000 },
      { user_id: uid, institution_id: inst("bdo"), type: "savings", name: "BDO Savings", last4: "0921", opening_balance_centavos: 3840215 },
      { user_id: uid, institution_id: inst("bpi"), type: "credit", name: "BPI Credit", last4: "4417", opening_balance_centavos: -1845020 },
      { user_id: uid, institution_id: inst("eastwest"), type: "credit", name: "EastWest", last4: "8830", opening_balance_centavos: -620475 },
      { user_id: uid, institution_id: inst("atome"), type: "bnpl", name: "Atome", last4: "4321", opening_balance_centavos: -199800 },
      { user_id: uid, institution_id: inst("bdo"), type: "loan", name: "BDO Personal Loan", opening_balance_centavos: -10000000 },
    ])
    .select("id, name"),
  "accounts",
);
const acct = (name: string) => accountRows.find((a) => a.name === name)!.id;
// Starting balances date from a month ago, so the sample transactions below count toward them.
must(await db.from("accounts").update({ opening_balance_at: ago(30 * DAY) }).eq("user_id", uid).select("id"), "opening dates");

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

// 6. Sample spending history (synthetic), a spending plan and savings goals, for the Spending page.
// History goes on the two credit cards only: the e2e tests check exact cash balances (GCash, Maya, BPI Savings).
// A fixed pseudo-random sequence so every reset looks the same.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const everyday = [
  { account: "BPI Credit", merchant: "7-Eleven", category: "Food", min: 6000, max: 25000 },
  { account: "EastWest", merchant: "Jollibee", category: "Food", min: 15000, max: 45000 },
  { account: "BPI Credit", merchant: "SM Supermarket", category: "Groceries", min: 80000, max: 320000 },
  { account: "BPI Credit", merchant: "Grab ride", category: "Transport", min: 12000, max: 38000 },
  { account: "EastWest", merchant: "Angkas", category: "Transport", min: 9000, max: 22000 },
  { account: "BPI Credit", merchant: "Shopee", category: "Shopping", min: 25000, max: 180000 },
  { account: "EastWest", merchant: "Smart Load", category: "Load & subscriptions", min: 9900, max: 29900 },
  { account: "BPI Credit", merchant: "Mercury Drug", category: "Health", min: 15000, max: 90000 },
  { account: "BPI Credit", merchant: "SM Cinema", category: "Entertainment", min: 35000, max: 70000 },
] as const;
const history = [];
for (let daysAgo = 75; daysAgo >= 1; daysAgo--) {
  const count = Math.floor(rand() * 3) + (rand() < 0.3 ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const item = everyday[Math.floor(rand() * everyday.length)];
    const amount = item.min + Math.round((rand() * (item.max - item.min)) / 100) * 100;
    const at = ago(daysAgo * DAY + Math.floor(rand() * 10) * 3_600_000);
    history.push({
      user_id: uid, account_id: acct(item.account), amount_centavos: -amount, occurred_at: at, merchant: item.merchant,
      category_id: cat(item.category), status: "confirmed" as const, source: "email" as const, confirmed_at: at,
    });
  }
}
// Subscriptions: same amount every month, so the Spending page spots them.
for (const daysAgo of [72, 42, 12]) {
  for (const sub of [
    { account: "EastWest", merchant: "NETFLIX.COM", amount: 54900 },
    { account: "BPI Credit", merchant: "Spotify Premium", amount: 19400 },
  ]) {
    const at = ago(daysAgo * DAY + 3 * 3_600_000);
    history.push({
      user_id: uid, account_id: acct(sub.account), amount_centavos: -sub.amount, occurred_at: at, merchant: sub.merchant,
      category_id: cat("Load & subscriptions"), status: "confirmed" as const, source: "email" as const, confirmed_at: at,
    });
  }
}
must(await db.from("transactions").insert(history).select("id"), "spending history");
must(
  await db.from("category_settings").insert([
    { user_id: uid, category_id: cat("Bills")!, fixed: true },
    { user_id: uid, category_id: cat("Food")!, fixed: false, monthly_limit_centavos: 300000 },
    { user_id: uid, category_id: cat("Shopping")!, fixed: false, monthly_limit_centavos: 200000 },
  ]).select("category_id"),
  "category settings",
);
must(
  await db.from("profiles").update({ monthly_income_centavos: 4500000, spending_limit_centavos: 2500000, paydays: [15, 31] }).eq("user_id", uid).select("user_id"),
  "spending plan",
);
must(
  await db.from("savings_goals").insert([
    { user_id: uid, name: "Emergency fund", target_centavos: 10000000, saved_centavos: 3250000, target_date: manilaDate(240) },
    { user_id: uid, name: "Japan trip", target_centavos: 6000000, saved_centavos: 850000, target_date: manilaDate(160) },
  ]).select("id"),
  "savings goals",
);

console.log(
  `Demo data ready for ${email}: ${accountRows.length} accounts, ${pending.length} transactions to review, ` +
    `${history.length} past transactions, 2 savings goals.`,
);
