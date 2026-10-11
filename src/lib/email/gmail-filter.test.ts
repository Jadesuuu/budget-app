import { describe, expect, it } from "vitest";
import { buildGmailFilterXml } from "./gmail-filter";

describe("buildGmailFilterXml", () => {
  const now = new Date("2026-10-11T08:00:00.123Z");

  it("forwards only the given sender domains to the Budget address", () => {
    const xml = buildGmailFilterXml({ forwardTo: "u_abc123defg@in.jadebonifacio.dev", domains: ["gcash.com", "BPI.com.ph"], now });
    expect(xml).toContain("<apps:property name='from' value='bpi.com.ph OR gcash.com'/>");
    expect(xml).toContain("<apps:property name='forwardTo' value='u_abc123defg@in.jadebonifacio.dev'/>");
    expect(xml).toContain("<updated>2026-10-11T08:00:00Z</updated>");
    expect(xml.match(/<entry>/g)).toHaveLength(1);
  });

  it("drops duplicates and anything that isn't a domain", () => {
    const xml = buildGmailFilterXml({
      forwardTo: "u_abc123defg@in.jadebonifacio.dev",
      domains: ["gcash.com", "gcash.com", "' OR 1=1", "nope", "<script>"],
      now,
    });
    expect(xml).toContain("value='gcash.com'");
    expect(xml).not.toContain("script");
  });

  it("refuses to build a filter with no domains, which would forward everything", () => {
    expect(() => buildGmailFilterXml({ forwardTo: "u_abc123defg@in.jadebonifacio.dev", domains: [], now })).toThrow();
  });

  it("rejects odd forwarding addresses", () => {
    expect(() => buildGmailFilterXml({ forwardTo: "x' onload='y@z.com", domains: ["gcash.com"], now })).toThrow();
  });
});
