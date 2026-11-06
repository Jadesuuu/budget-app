/**
 * Just enough of PostgREST for the demo build: it turns the HTTP requests supabase-js makes into SQL against an
 * in-process Postgres (PGlite) that ran the real migrations, so triggers, views and RPCs behave as in production.
 *
 * Covers what this app uses: select with many-to-one / one-to-many embeds and `alias:col`, the eq/neq/gt/gte/lt/lte/
 * like/ilike/is/in filters with `not.`, `or=(...)`, order, limit/offset, count=exact (incl. HEAD), single objects,
 * insert/upsert (on_conflict, merge/ignore), update, delete, return=representation, and RPC.
 * shortcut: no embedded filters/ordering (`accounts.type=eq.x`), no aggregates or JSON paths; add them if a query needs one.
 */

export type Sql = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

/** A foreign key: `cols` on the referencing table point at `refCols` on the referenced one. */
type Relation = { cols: string[]; refCols: string[] };
export type Meta = {
  /** `${from}->${to}` → the foreign keys on `from` pointing at `to` (many-to-one). */
  manyToOne: Map<string, Relation[]>;
  primaryKeys: Map<string, string[]>;
  functions: Map<string, { returnsSet: boolean; composite: boolean; void: boolean }>;
};

export async function loadMeta(db: Sql): Promise<Meta> {
  // Composite keys too: tables reference their parent as (id, user_id) so ownership can't drift.
  const fks = await db.query<{ src: string; tgt: string; cols: string[]; tcols: string[] }>(`
    select cs.relname as src, ct.relname as tgt,
      array(select a.attname::text from unnest(c.conkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.i) as cols,
      array(select a.attname::text from unnest(c.confkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.i) as tcols
    from pg_constraint c
    join pg_class cs on cs.oid = c.conrelid
    join pg_class ct on ct.oid = c.confrelid
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
  const manyToOne = new Map<string, Relation[]>();
  for (const fk of fks.rows) {
    const key = `${fk.src}->${fk.tgt}`;
    manyToOne.set(key, [...(manyToOne.get(key) ?? []), { cols: fk.cols, refCols: fk.tcols }]);
  }
  const pks = await db.query<{ tbl: string; col: string }>(`
    select c.relname as tbl, a.attname as col
    from pg_index i join pg_class c on c.oid = i.indrelid
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary and c.relnamespace = 'public'::regnamespace`);
  const primaryKeys = new Map<string, string[]>();
  for (const pk of pks.rows) primaryKeys.set(pk.tbl, [...(primaryKeys.get(pk.tbl) ?? []), pk.col]);
  const fns = await db.query<{ name: string; retset: boolean; typtype: string; typname: string }>(`
    select p.proname as name, p.proretset as retset, t.typtype, t.typname
    from pg_proc p join pg_type t on t.oid = p.prorettype
    where p.pronamespace = 'public'::regnamespace`);
  const functions = new Map(
    fns.rows.map((f) => [f.name, { returnsSet: f.retset, composite: f.typtype === "c", void: f.typname === "void" }]),
  );
  return { manyToOne, primaryKeys, functions };
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string | null = null,
    readonly hint: string | null = null,
  ) {
    super(message);
  }
}

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new ApiError(400, "PGRST100", `Invalid identifier: ${name}`);
  return `"${name}"`;
};

// ---------------------------------------------------------------------------
// select=
// ---------------------------------------------------------------------------
type Field = { kind: "star" } | { kind: "col"; name: string; alias: string } | { kind: "embed"; table: string; alias: string; fields: Field[] };

/** Splits on commas that are not inside parentheses or double quotes. */
function splitTop(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === ",") {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current !== "") parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseSelect(select: string): Field[] {
  return splitTop(select).map((part): Field => {
    if (part === "*") return { kind: "star" };
    const open = part.indexOf("(");
    if (open !== -1 && part.endsWith(")")) {
      const head = part.slice(0, open);
      const [alias, target] = head.includes(":") ? head.split(":") : [null, head];
      const table = target.split("!")[0];
      return { kind: "embed", table, alias: alias ?? table, fields: parseSelect(part.slice(open + 1, -1)) };
    }
    const [alias, name] = part.includes(":") ? part.split(":") : [part, part];
    return { kind: "col", name: name.split("::")[0], alias };
  });
}

/** A jsonb expression for one row of `table` aliased `alias`, at nesting `depth`. */
function rowJson(meta: Meta, table: string, alias: string, fields: Field[], depth: number): string {
  const parts: string[] = [];
  const pairs: string[] = [];
  for (const f of fields) {
    if (f.kind === "star") parts.push(`to_jsonb(${alias})`);
    else if (f.kind === "col") pairs.push(`'${f.alias}', ${alias}.${ident(f.name)}`);
    else pairs.push(`'${f.alias}', ${embedJson(meta, table, alias, f, depth + 1)}`);
  }
  // jsonb_build_object takes at most 100 arguments; split into chunks of 50 pairs.
  for (let i = 0; i < pairs.length; i += 50) parts.push(`jsonb_build_object(${pairs.slice(i, i + 50).join(", ")})`);
  return parts.length ? parts.join(" || ") : `'{}'::jsonb`;
}

function embedJson(meta: Meta, from: string, fromAlias: string, embed: Extract<Field, { kind: "embed" }>, depth: number) {
  const t = `t${depth}`;
  const target = ident(embed.table);
  const inner = rowJson(meta, embed.table, t, embed.fields, depth);
  const toOne = meta.manyToOne.get(`${from}->${embed.table}`);
  if (toOne?.length) {
    const rel = toOne.find((r) => r.cols[0] === `${singular(embed.table)}_id`) ?? toOne[0];
    return `(select ${inner} from public.${target} ${t} where ${join(rel, t, fromAlias)})`;
  }
  const toMany = meta.manyToOne.get(`${embed.table}->${from}`);
  if (toMany?.length) {
    const rel = toMany.find((r) => r.cols[0] === `${singular(from)}_id`) ?? toMany[0];
    return `coalesce((select jsonb_agg(${inner}) from public.${target} ${t} where ${join(rel, fromAlias, t)}), '[]'::jsonb)`;
  }
  throw new ApiError(400, "PGRST200", `Could not find a relationship between '${from}' and '${embed.table}'`);
}

/** `referencing.cols = referenced.refCols`, column by column. */
const join = (rel: Relation, referenced: string, referencing: string) =>
  rel.cols.map((col, i) => `${referenced}.${ident(rel.refCols[i])} = ${referencing}.${ident(col)}`).join(" and ");

const singular = (table: string) =>
  table.endsWith("ies") ? `${table.slice(0, -3)}y` : table.endsWith("ses") ? table.slice(0, -2) : table.replace(/s$/, "");

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
class Params {
  values: unknown[] = [];
  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function unquote(value: string) {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
}

const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

function condition(column: string, expr: string, params: Params, alias: string): string {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const raw = dot === -1 ? "" : rest.slice(dot + 1);
  const col = `${alias}.${ident(column)}`;
  let sql: string;
  if (op in OPS) {
    const value = op === "like" || op === "ilike" ? unquote(raw).replace(/\*/g, "%") : unquote(raw);
    sql = `${col} ${OPS[op]} ${params.add(value)}`;
  } else if (op === "is") {
    const v = raw.toLowerCase();
    if (!["null", "true", "false", "unknown"].includes(v)) throw new ApiError(400, "PGRST100", `Bad is value: ${raw}`);
    sql = `${col} is ${v}`;
  } else if (op === "in") {
    const list = splitTop(raw.replace(/^\(/, "").replace(/\)$/, "")).map(unquote);
    sql = list.length ? `${col}::text = any(${params.add(pgArray(list))}::text[])` : "false";
  } else throw new ApiError(400, "PGRST100", `Unsupported operator: ${op}`);
  return negate ? `not (${sql})` : sql;
}

/** `or=(a.eq.1,and(b.is.null,c.gt.2))` */
function logical(kind: "and" | "or", body: string, params: Params, alias: string): string {
  const inner = body.replace(/^\(/, "").replace(/\)$/, "");
  const parts = splitTop(inner).map((part) => {
    const nested = part.match(/^(not\.)?(and|or)\((.*)\)$/);
    if (nested) {
      const sql = logical(nested[2] as "and" | "or", `(${nested[3]})`, params, alias);
      return nested[1] ? `not (${sql})` : sql;
    }
    const dot = part.indexOf(".");
    return condition(part.slice(0, dot), part.slice(dot + 1), params, alias);
  });
  return `(${parts.join(` ${kind} `) || "true"})`;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

function where(search: URLSearchParams, params: Params, alias: string): string {
  const parts: string[] = [];
  for (const [key, value] of search) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and") parts.push(logical(key, value, params, alias));
    else if (key === "not.or" || key === "not.and") parts.push(`not ${logical(key.slice(4) as "and" | "or", value, params, alias)}`);
    else if (key.includes(".")) throw new ApiError(400, "PGRST100", `Embedded filters are not supported in the demo: ${key}`);
    else parts.push(condition(key, value, params, alias));
  }
  return parts.length ? `where ${parts.join(" and ")}` : "";
}

function orderBy(order: string | null, alias: string): string {
  if (!order) return "";
  const terms = splitTop(order).map((term) => {
    const [col, ...mods] = term.split(".");
    const dir = mods.includes("desc") ? "desc" : "asc";
    const nulls = mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : "";
    return `${alias}.${ident(col)} ${dir}${nulls}`;
  });
  return `order by ${terms.join(", ")}`;
}

/** A Postgres array literal: `{"a","b"}`. */
function pgArray(values: unknown[]): string {
  return `{${values
    .map((v) => (v === null ? "NULL" : `"${String(typeof v === "object" ? JSON.stringify(v) : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`))
    .join(",")}}`;
}

/** Values cross into SQL as text and Postgres casts them to the column or argument type. */
function toParam(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return pgArray(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------
type Prefer = { representation: boolean; count: boolean; resolution: "merge" | "ignore" | null };

function prefer(headers: Headers): Prefer {
  const value = headers.get("prefer") ?? "";
  return {
    representation: value.includes("return=representation"),
    count: value.includes("count=exact") || value.includes("count=planned") || value.includes("count=estimated"),
    resolution: value.includes("resolution=merge-duplicates") ? "merge" : value.includes("resolution=ignore-duplicates") ? "ignore" : null,
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function respondRows(request: Request, rows: unknown[], status: number, total: number | null, offset = 0) {
  const headers: Record<string, string> = {};
  if (total !== null) headers["content-range"] = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
  if (request.method === "HEAD") return new Response(null, { status, headers });
  if ((request.headers.get("accept") ?? "").includes("application/vnd.pgrst.object+json")) {
    if (rows.length !== 1) {
      return json(406, {
        code: "PGRST116",
        details: `The result contains ${rows.length} rows`,
        hint: null,
        message: "Cannot coerce the result to a single JSON object",
      });
    }
    return json(status, rows[0], headers);
  }
  return json(status, rows, headers);
}

export async function handle(db: Sql, meta: Meta, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    if (path.startsWith("rpc/")) return await rpc(db, meta, request, path.slice(4), url);
    return await table(db, meta, request, path, url);
  } catch (error) {
    if (error instanceof ApiError) return json(error.status, { code: error.code, message: error.message, details: error.details, hint: error.hint });
    const pg = error as { code?: string; message?: string; detail?: string; hint?: string };
    const status = pg.code === "23505" ? 409 : pg.code === "42501" ? 403 : pg.code === "P0002" ? 404 : 400;
    return json(status, { code: pg.code ?? "", message: pg.message ?? String(error), details: pg.detail ?? null, hint: pg.hint ?? null });
  }
}

async function table(db: Sql, meta: Meta, request: Request, name: string, url: URL): Promise<Response> {
  const tbl = `public.${ident(name)}`;
  const fields = parseSelect(url.searchParams.get("select") ?? "*");
  const pref = prefer(request.headers);
  const params = new Params();
  const project = (alias: string) => rowJson(meta, name, alias, fields, 0);

  if (request.method === "GET" || request.method === "HEAD") {
    const filter = where(url.searchParams, params, "t0");
    const limit = url.searchParams.get("limit");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const page = `${limit ? `limit ${Number(limit)}` : ""} ${offset ? `offset ${offset}` : ""}`;
    const rows = await db.query<{ r: unknown }>(
      `select ${project("t0")} as r from ${tbl} t0 ${filter} ${orderBy(url.searchParams.get("order"), "t0")} ${page}`,
      params.values,
    );
    let total: number | null = null;
    if (pref.count) {
      const counted = await db.query<{ n: number }>(`select count(*)::int as n from ${tbl} t0 ${filter}`, params.values);
      total = counted.rows[0].n;
    }
    return respondRows(request, rows.rows.map((r) => r.r), 200, total, offset);
  }

  if (request.method === "POST") {
    const body = (await request.json()) as Record<string, unknown> | Record<string, unknown>[];
    const records = Array.isArray(body) ? body : [body];
    const conflict = url.searchParams.get("on_conflict")?.split(",").map((c) => c.trim()) ?? meta.primaryKeys.get(name) ?? [];
    const out: unknown[] = [];
    for (const record of records) {
      const p = new Params();
      const cols = Object.keys(record);
      const values = cols.map((c) => p.add(toParam(record[c])));
      let onConflict = "";
      if (pref.resolution === "ignore") onConflict = `on conflict (${conflict.map(ident).join(", ")}) do nothing`;
      if (pref.resolution === "merge") {
        const updates = cols.filter((c) => !conflict.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
        onConflict = `on conflict (${conflict.map(ident).join(", ")}) ${updates.length ? `do update set ${updates.join(", ")}` : "do nothing"}`;
      }
      const insert = cols.length
        ? `insert into ${tbl} (${cols.map(ident).join(", ")}) values (${values.join(", ")}) ${onConflict} returning *`
        : `insert into ${tbl} default values returning *`;
      const rows = await db.query<{ r: unknown }>(`with w as (${insert}) select ${project("t0")} as r from w t0`, p.values);
      out.push(...rows.rows.map((r) => r.r));
    }
    return pref.representation ? respondRows(request, out, 201, pref.count ? out.length : null) : new Response(null, { status: 201 });
  }

  if (request.method === "PATCH" || request.method === "DELETE") {
    const filter = where(url.searchParams, params, "t0");
    let statement: string;
    if (request.method === "PATCH") {
      const body = (await request.json()) as Record<string, unknown>;
      const sets = Object.entries(body).map(([c, v]) => `${ident(c)} = ${params.add(toParam(v))}`);
      if (!sets.length) return json(400, { code: "PGRST102", message: "Empty update", details: null, hint: null });
      statement = `update ${tbl} as t0 set ${sets.join(", ")} ${filter} returning t0.*`;
    } else statement = `delete from ${tbl} as t0 ${filter} returning t0.*`;
    const rows = await db.query<{ r: unknown }>(`with w as (${statement}) select ${project("t0")} as r from w t0`, params.values);
    const list = rows.rows.map((r) => r.r);
    return pref.representation ? respondRows(request, list, 200, pref.count ? list.length : null) : new Response(null, { status: 204 });
  }

  return json(405, { code: "PGRST000", message: `Method ${request.method} not supported`, details: null, hint: null });
}

async function rpc(db: Sql, meta: Meta, request: Request, fn: string, url: URL): Promise<Response> {
  const info = meta.functions.get(fn);
  if (!info) throw new ApiError(404, "PGRST202", `Could not find the function public.${fn}`);
  const args: Record<string, unknown> =
    request.method === "POST" ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : Object.fromEntries(url.searchParams);
  const params = new Params();
  const named = Object.entries(args).map(([k, v]) => `${ident(k)} => ${params.add(toParam(v))}`);
  const call = `public.${ident(fn)}(${named.join(", ")})`;
  if (info.void) {
    await db.query(`select ${call}`, params.values);
    return new Response(null, { status: 204 });
  }
  if (info.returnsSet || info.composite) {
    const rows = await db.query<{ r: unknown }>(`select to_jsonb(x) as r from ${call} x`, params.values);
    const list = rows.rows.map((r) => r.r);
    return info.returnsSet ? respondRows(request, list, 200, null) : json(200, list[0] ?? null);
  }
  const result = await db.query<{ r: unknown }>(`select to_jsonb(${call}) as r`, params.values);
  return json(200, result.rows[0]?.r ?? null);
}
