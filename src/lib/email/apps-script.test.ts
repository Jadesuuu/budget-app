import { describe, expect, it } from "vitest";
import { buildForwardingScript } from "./apps-script";

describe("buildForwardingScript", () => {
  it("fills in the Budget address and only clean sender domains", () => {
    const script = buildForwardingScript({
      forwardTo: "u_abc123defg@in.jadebonifacio.dev",
      domains: ["BPI.com.ph", "gcash.com", "gcash.com", "bad domain\"); evil()//"],
    });
    expect(script).toContain('const BUDGET_ADDRESS = "u_abc123defg@in.jadebonifacio.dev";');
    expect(script).toContain('const BANK_SENDERS = ["bpi.com.ph","gcash.com"];');
    expect(script).not.toContain("evil");
    expect(script).toContain("function setup()");
  });

  it("refuses anything that isn't a Budget address", () => {
    expect(() => buildForwardingScript({ forwardTo: "someone@gmail.com", domains: ["gcash.com"] })).toThrow();
    expect(() => buildForwardingScript({ forwardTo: "u_abc123defg@in.jadebonifacio.dev", domains: [] })).toThrow();
  });
});
