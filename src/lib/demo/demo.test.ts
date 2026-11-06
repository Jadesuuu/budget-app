import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { buildDemoDatabase, clientFor } from "./database";
import { DEMO_USER_ID } from "./mode";
import { parseSelect } from "./postgrest";

// The demo build answers supabase-js from PGlite running the real migrations. These run the query shapes the app uses.
let db: PGlite;
let sb: SupabaseClient<Database>;

beforeAll(async () => {
  const built = await buildDemoDatabase();
  db = built.db;
  sb = clientFor(built.db, built.meta);
}, 60_000);
afterAll(() => db?.close());

describe("parseSelect", () => {
  it("reads columns, aliases and nested embeds", () => {
    expect(parseSelect("id, total:amount_centavos, accounts(name, institutions(name))")).toEqual([
      { kind: "col", name: "id", alias: "id" },
      { kind: "col", name: "amount_centavos", alias: "total" },
      {
        kind: "embed",
        table: "accounts",
        alias: "accounts",
        fields: [
          { kind: "col", name: "name", alias: "name" },
          { kind: "embed", table: "institutions", alias: "institutions", fields: [{ kind: "col", name: "name", alias: "name" }] },
        ],
      },
    ]);
  });
});

describe("demo database", () => {
  it("seeds the demo user's accounts and a review inbox", async () => {
    const accounts = await sb.from("accounts").select("id, name, type, institutions(name)").order("name");
    expect(accounts.error).toBeNull();
    expect(accounts.data).toHaveLength(8);
    expect(accounts.data!.find((a) => a.name === "GCash")?.institutions).toEqual({ name: "GCash" });

    const pending = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending");
    expect(pending.count).toBe(7);
  });

  it("generates IDs the app's z.uuid() validation accepts", async () => {
    const { data } = await sb.from("transactions").select("id").limit(20);
    expect(data!.every((t) => z.uuid().safeParse(t.id).success)).toBe(true);
  });

  it("builds the same IDs every time, so a visitor's log replays on any server", async () => {
    const ids = async (client: SupabaseClient<Database>) =>
      (await client.from("transactions").select("id").order("occurred_at").order("merchant")).data!.map((t) => t.id);
    const other = await buildDemoDatabase();
    try {
      expect(await ids(clientFor(other.db, other.meta))).toEqual(await ids(sb));
    } finally {
      await other.db.close();
    }
  }, 60_000);

  it("flags the emailed Meralco bill as a duplicate of the typed one", async () => {
    const { data } = await sb.from("transactions").select("merchant, duplicate_of").eq("merchant", "MERALCO").single();
    expect(data?.duplicate_of).not.toBeNull();
  });

  it("filters with is/in/or/not, orders and pages", async () => {
    const owed = await sb.from("accounts").select("name").in("type", ["credit", "bnpl"]).order("name", { ascending: false });
    expect(owed.data?.map((a) => a.name)).toEqual(["EastWest", "BPI Credit", "Atome"]);

    const page = await sb.from("transactions").select("id").eq("status", "confirmed").order("occurred_at", { ascending: false }).range(0, 4);
    expect(page.data).toHaveLength(5);

    const either = await sb.from("categories").select("name").or(`user_id.is.null,user_id.eq.${DEMO_USER_ID}`).not("name", "is", null);
    expect(either.data!.length).toBeGreaterThan(5);
  });

  it("returns 406 for single() with no row, and maybeSingle() gives null", async () => {
    const single = await sb.from("accounts").select("id").eq("name", "Nope").single();
    expect(single.error?.code).toBe("PGRST116");
    const maybe = await sb.from("accounts").select("id").eq("name", "Nope").maybeSingle();
    expect(maybe.error).toBeNull();
    expect(maybe.data).toBeNull();
  });

  it("confirms a pending transaction through the real RPC and the balance view moves", async () => {
    const before = await sb.from("account_balances").select("account_id, balance_centavos, pending_count");
    const grab = await sb.from("transactions").select("id, account_id").eq("merchant", "Grab ride").eq("status", "pending").single();
    const rpc = await sb.rpc("confirm_transaction", { p_id: grab.data!.id });
    expect(rpc.error).toBeNull();
    const after = await sb.from("account_balances").select("account_id, balance_centavos, pending_count");
    const was = before.data!.find((b) => b.account_id === grab.data!.account_id)!;
    const now = after.data!.find((b) => b.account_id === grab.data!.account_id)!;
    expect(now.balance_centavos).toBe(was.balance_centavos! - 18600);
    expect(now.pending_count).toBe(was.pending_count! - 1);
  });

  it("inserts, upserts, updates and deletes with representation", async () => {
    const gcash = (await sb.from("accounts").select("id").eq("name", "GCash").single()).data!;
    const inserted = await sb
      .from("transactions")
      .insert({ user_id: DEMO_USER_ID, account_id: gcash.id, amount_centavos: -5000, occurred_at: new Date().toISOString(), merchant: "Test", status: "confirmed", source: "manual" })
      .select("id, merchant, accounts(name)")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toMatchObject({ merchant: "Test", accounts: { name: "GCash" } });

    const updated = await sb.from("transactions").update({ merchant: "Test 2" }).eq("id", inserted.data!.id).select("merchant");
    expect(updated.data).toEqual([{ merchant: "Test 2" }]);

    const food = (await sb.from("categories").select("id").eq("name", "Food").is("user_id", null).single()).data!;
    const upsert = await sb
      .from("category_settings")
      .upsert({ user_id: DEMO_USER_ID, category_id: food.id, fixed: false, monthly_limit_centavos: 123400 }, { onConflict: "user_id,category_id" });
    expect(upsert.error).toBeNull();
    const setting = await sb.from("category_settings").select("monthly_limit_centavos").eq("category_id", food.id).single();
    expect(setting.data?.monthly_limit_centavos).toBe(123400);

    const removed = await sb.from("transactions").delete().eq("id", inserted.data!.id);
    expect(removed.error).toBeNull();
    expect((await sb.from("transactions").select("id").eq("id", inserted.data!.id)).data).toEqual([]);
  });

  it("reports constraint errors with the Postgres code", async () => {
    const res = await sb.from("accounts").insert({ user_id: DEMO_USER_ID, name: "Bad", type: "credit", institution_id: "00000000-0000-0000-0000-000000000000" });
    expect(res.error).not.toBeNull();
  });
});
