import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO_EMAIL, DEMO_USER_ID } from "./mode.ts";
import { handle, loadMeta, type Meta } from "./postgrest.ts";
import { seedDemoData } from "./seed.ts";

export const DEMO_URL = "http://demo.invalid";

// What Supabase provides around a plain Postgres: the auth schema, roles, pgcrypto under `extensions`.
// gen_random_uuid() draws from a sequence, so replaying the same writes on the same snapshot yields the same IDs.
const SHIM = `
create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (
  id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create sequence public.demo_id_seq;
-- Shaped as version 4 (version 4, variant 8), since the app validates IDs with z.uuid(). It must stay one inlinable
-- expression: Postgres calls built-in function OIDs directly, so only an inlined body ever replaces the original.
create or replace function pg_catalog.gen_random_uuid() returns uuid language sql volatile as $$
  select overlay(overlay(md5('budget-demo-' || nextval('public.demo_id_seq')) placing '4' from 13) placing '8' from 17)::uuid
$$;
`;

/** Opens a database, from a snapshot when given, acting as the demo user. */
export async function openDemoDatabase(snapshot?: Blob) {
  const db = await PGlite.create({ extensions: { pgcrypto }, ...(snapshot ? { loadDataDir: snapshot } : {}) });
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [DEMO_USER_ID]);
  return db;
}

/** A Supabase client whose requests are answered by `db` instead of the network. */
export function clientFor(db: PGlite, meta: Meta): SupabaseClient<Database> {
  return createClient<Database>(DEMO_URL, "demo", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => handle(db, meta, new Request(input, init)) },
  });
}

/** Runs every migration, creates the demo user and seeds their data. */
export async function buildDemoDatabase(now = Date.now()) {
  const db = await openDemoDatabase();
  await db.exec(SHIM);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [DEMO_USER_ID, DEMO_EMAIL]);
  await db.query(`update public.profiles set display_name = 'Sam Reyes', theme = 'coal' where user_id = $1`, [DEMO_USER_ID]);
  const meta = await loadMeta(db);
  await seedDemoData(clientFor(db, meta), DEMO_USER_ID, now);
  return { db, meta };
}

// Written by `pnpm build` in demo mode (scripts/demo-snapshot.mts), so a cold start skips the migrations and the seed.
export const SNAPSHOT_FILE = path.join(process.cwd(), ".demo", "base.tar.gz");
export const SNAPSHOT_TIME_FILE = path.join(process.cwd(), ".demo", "built-at.txt");

const manilaDay = (ms: number) => Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(ms)) / 86_400_000;

/** Moves every date and timestamp forward by the time since `builtAt`, so the data reads as if seeded at `now`. */
export async function shiftDates(db: PGlite, builtAt: number, now = Date.now()) {
  const cols = await db.query<{ tbl: string; col: string; type: string }>(`
    select format('%I.%I', c.table_schema, c.table_name) as tbl, quote_ident(c.column_name) as col, c.data_type as type
    from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema in ('public', 'auth') and t.table_type = 'BASE TABLE' and c.is_generated = 'NEVER'
      and c.data_type in ('date', 'timestamp with time zone', 'timestamp without time zone')`);
  const ms = Math.round(now - builtAt);
  const days = Math.round(manilaDay(now) - manilaDay(builtAt)); // seed dates are Manila calendar days
  const byTable = new Map<string, string[]>();
  for (const { tbl, col, type } of cols.rows) {
    const set = type === "date" ? `${col} = ${col} + ${days}` : `${col} = ${col} + interval '${ms} milliseconds'`;
    byTable.set(tbl, [...(byTable.get(tbl) ?? []), set]);
  }
  // Triggers off: this is a clock move, not an edit (no updated_at bumps, no recomputed side effects).
  await db.exec(
    "set session_replication_role = replica;\n" +
      [...byTable].map(([tbl, sets]) => `update ${tbl} set ${sets.join(", ")};`).join("\n") +
      "\nset session_replication_role = origin;",
  );
  // Monthly installments are month arithmetic, not a fixed day count: recompute as build_installment_schedule() does.
  await db.exec(`
    update public.installment_payments p set due_date = case l.frequency
      when 'monthly' then (l.first_due_date + make_interval(months => p.seq - 1))::date
      else l.first_due_date + 14 * (p.seq - 1) end
    from public.installment_plans l where l.id = p.plan_id`);
}

/** The seeded demo database: the build's snapshot moved to `now` in production, else built from scratch. */
export async function baseDemoDatabase(now = Date.now()) {
  if (process.env.NODE_ENV !== "production" || !fs.existsSync(SNAPSHOT_FILE)) return buildDemoDatabase(now);
  const db = await openDemoDatabase(new Blob([fs.readFileSync(SNAPSHOT_FILE)]));
  await shiftDates(db, Number(fs.readFileSync(SNAPSHOT_TIME_FILE, "utf8")), now);
  return { db, meta: await loadMeta(db) };
}
