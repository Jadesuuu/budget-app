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

describe("the generated script, run against a fake Gmail", () => {
  it("forwards only bank emails, in a form Budget reads as from the bank", async () => {
    const { readMessage } = await import("./message");
    const script = buildForwardingScript({ forwardTo: "u_abc123defg@in.jadebonifacio.dev", domains: ["bpi.com.ph"] });
    const sent: { to: string; subject: string; body: string; html: string }[] = [];
    const now = Date.now();
    const message = (from: string, subject: string) => ({
      getFrom: () => from,
      getTo: () => "someone.example@gmail.com",
      getSubject: () => subject,
      getDate: () => new Date(now - 60_000),
      getPlainBody: () => "Amount PHP 289.00",
      getBody: () => "<p>Amount PHP 289.00</p>",
    });
    const thread = { getMessages: () => [message("BPI <alerts@bpi.com.ph>", "Card alert"), message("Mama <mama@gmail.com>", "Kain")], addLabel: () => {} };
    const props = new Map<string, string>([["lastRun", String(now - 3_600_000)]]);
    const fakes = {
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => props.set(k, v) }) },
      GmailApp: {
        getUserLabelByName: () => ({}),
        createLabel: () => ({}),
        search: () => [thread],
        sendEmail: (to: string, subject: string, body: string, opts: { htmlBody: string }) => sent.push({ to, subject, body, html: opts.htmlBody }),
      },
      Utilities: { formatDate: (d: Date) => d.toUTCString() },
      ScriptApp: {},
    };
    new Function(...Object.keys(fakes), `${script}\nforwardBankEmails();`)(...Object.values(fakes));

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("u_abc123defg@in.jadebonifacio.dev");
    const raw = [
      "From: Someone <someone.example@gmail.com>",
      `To: ${sent[0].to}`,
      `Subject: ${sent[0].subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      sent[0].body,
    ].join("\r\n");
    const msg = await readMessage(raw);
    expect(msg.from).toBe("alerts@bpi.com.ph");
    expect(msg.forwardedBy).toBe("someone.example@gmail.com");
    expect(msg.subject).toBe("Card alert");
    expect(msg.text).toContain("Amount PHP 289.00");
  });
});
