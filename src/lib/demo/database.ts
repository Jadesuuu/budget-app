import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO_EMAIL, DEMO_USER_ID } from "./mode";
import { handle, loadMeta, type Meta } from "./postgrest";
import { seedDemoData } from "./seed";

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
