import "server-only";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { PGlite } from "@electric-sql/pglite";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { baseDemoDatabase, DEMO_URL, openDemoDatabase } from "./database";
import { handle, type Meta } from "./postgrest";

/*
 * The demo build's database. Every visitor starts from the same seeded snapshot (database.ts). Their writes are
 * recorded as a log in their own cookies and replayed onto the snapshot whenever a server instance hasn't seen them
 * yet, so changes survive across serverless instances without any shared storage.
 */

const ID_COOKIE = "demo-id";
const LOG_COOKIE = "demo-log";
const CHUNK = 3500;
const MAX_CHUNKS = 4;
const MAX_VISITORS = 6;

type Op = { m: string; u: string; p: string; a: string; b: string | null };
type Jar = Awaited<ReturnType<typeof cookies>>;

let base: Promise<{ snapshot: Blob; meta: Meta }> | null = null;
const visitors = new Map<string, { db: Promise<PGlite>; ops: string[]; lock: Promise<unknown> }>();

function snapshot() {
  base ??= (async () => {
    const { db, meta } = await baseDemoDatabase();
    const dump = await db.dumpDataDir("none");
    await db.close();
    return { snapshot: dump, meta };
  })();
  base.catch(() => (base = null));
  return base;
}

/** Applies one write inside a transaction, so a failed write leaves nothing behind. */
async function apply(db: PGlite, meta: Meta, request: Request) {
  await db.exec("begin");
  try {
    const response = await handle(db, meta, request);
    await db.exec(response.ok ? "commit" : "rollback");
    return response;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

const toRequest = (op: Op) =>
  new Request(DEMO_URL + op.u, { method: op.m, headers: { prefer: op.p, accept: op.a, "content-type": "application/json" }, body: op.b });

/** Runs `fn` with this visitor's database, brought up to date with their log, one call at a time per visitor. */
async function withDb<T>(key: string, ops: string[], fn: (db: PGlite, meta: Meta) => Promise<T>): Promise<T> {
  const { snapshot: dump, meta } = await snapshot();
  let entry = visitors.get(key);
  if (entry) visitors.delete(key); // re-inserted below, so the map stays in least-recently-used order
  entry ??= { db: openDemoDatabase(dump), ops: [], lock: Promise.resolve() };
  visitors.set(key, entry);
  while (visitors.size > MAX_VISITORS) {
    const [oldest, evicted] = visitors.entries().next().value!;
    visitors.delete(oldest);
    evicted.lock.then(() => evicted.db).then((db) => db.close()).catch(() => {});
  }
  const current = entry;
  const run = current.lock.then(async () => {
    const isPrefix = current.ops.length <= ops.length && current.ops.every((op, i) => op === ops[i]);
    if (!isPrefix) {
      // This instance holds changes the visitor no longer has (a reset, or a write whose cookie never landed).
      current.db.then((db) => db.close()).catch(() => {});
      current.db = openDemoDatabase(dump);
      current.ops = [];
    }
    const db = await current.db;
    for (const raw of ops.slice(current.ops.length)) await apply(db, meta, toRequest(JSON.parse(raw) as Op));
    current.ops = [...ops];
    return fn(db, meta);
  });
  current.lock = run.catch(() => {});
  return run;
}

const encode = (ops: string[]) => deflateRawSync(JSON.stringify(ops)).toString("base64url");

async function readLog() {
  const jar = await cookies();
  const id = jar.get(ID_COOKIE)?.value ?? null;
  let encoded = "";
  for (let i = 0; i < MAX_CHUNKS; i++) encoded += jar.get(`${LOG_COOKIE}-${i}`)?.value ?? "";
  let ops: string[] = [];
  if (id && encoded) {
    try {
      ops = JSON.parse(inflateRawSync(Buffer.from(encoded, "base64url")).toString("utf8"));
    } catch {
      ops = []; // A damaged log starts the visitor over rather than breaking every page.
    }
  }
  return { id, ops };
}

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

function writeLog(jar: Jar, id: string, encoded: string) {
  jar.set(ID_COOKIE, id, cookieOptions);
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = encoded.slice(i * CHUNK, (i + 1) * CHUNK);
    if (part) jar.set(`${LOG_COOKIE}-${i}`, part, cookieOptions);
    else if (jar.get(`${LOG_COOKIE}-${i}`)) jar.delete(`${LOG_COOKIE}-${i}`);
  }
}

const FULL = JSON.stringify({
  code: "DEMO_FULL",
  message: "This demo has saved as many changes as it can. Use Reset in the demo banner to start over.",
  details: null,
  hint: null,
});

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { id, ops } = await readLog();
  if (request.method === "GET" || request.method === "HEAD") {
    return withDb(id ?? "base", id ? ops : [], (db, meta) => handle(db, meta, request));
  }

  const url = new URL(request.url);
  const op: Op = {
    m: request.method,
    u: url.pathname + url.search,
    p: request.headers.get("prefer") ?? "",
    a: request.headers.get("accept") ?? "",
    b: request.body ? await request.text() : null,
  };
  const visitor = id ?? crypto.randomUUID();
  const next = [...(id ? ops : []), JSON.stringify(op)];
  const encoded = encode(next);
  if (encoded.length > CHUNK * MAX_CHUNKS) return new Response(FULL, { status: 400, headers: { "content-type": "application/json" } });

  return withDb(visitor, id ? ops : [], async (db, meta) => {
    const response = await apply(db, meta, toRequest(op));
    if (response.ok) {
      try {
        writeLog(await cookies(), visitor, encoded);
        const entry = visitors.get(visitor);
        if (entry) entry.ops = next;
      } catch {
        // Cookies are read-only while a page renders: the change stays on this instance until it rebuilds.
      }
    }
    return response;
  });
}

/** The demo's stand-in for the Supabase client: same API, answered by the in-process database. */
export function createDemoClient(): SupabaseClient<Database> {
  return createClient<Database>(DEMO_URL, "demo", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: demoFetch },
  });
}

/** Clears this visitor's changes; the next request starts from the seeded data again. */
export async function resetDemo() {
  const jar = await cookies();
  for (let i = 0; i < MAX_CHUNKS; i++) jar.delete(`${LOG_COOKIE}-${i}`);
  jar.delete(ID_COOKIE);
}
