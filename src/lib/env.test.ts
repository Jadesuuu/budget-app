import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import("./env");
}

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("env", () => {
  it("trims values pasted with stray spaces, so the Budget address has none", async () => {
    const { env } = await loadEnv({ ...base, INBOUND_EMAIL_DOMAIN: " In.Jadebonifacio.dev \n", PARSE_JOB_SECRET: ` ${"a".repeat(48)}\n` });
    expect(env.INBOUND_EMAIL_DOMAIN).toBe("in.jadebonifacio.dev");
    expect(env.PARSE_JOB_SECRET).toBe("a".repeat(48));
  });

  it("rejects a domain that isn't a bare hostname", async () => {
    await expect(loadEnv({ ...base, INBOUND_EMAIL_DOMAIN: "in .jadebonifacio.dev" })).rejects.toThrow();
    await expect(loadEnv({ ...base, INBOUND_EMAIL_DOMAIN: "@in.jadebonifacio.dev" })).rejects.toThrow();
    await expect(loadEnv({ ...base, INBOUND_EMAIL_DOMAIN: "in_jadebonifacio_dev" })).rejects.toThrow();
  });
});
