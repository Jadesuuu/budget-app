// Cloudflare Email Worker: receives mail for u_xxxxxxxxxx@<inbound domain> and stores it untouched.
// No parsing here (CLAUDE.md): the parse job reads raw_emails separately and can be re-run.

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  /** Optional: Next.js endpoint that parses pending emails right away (cron re-runs it anyway). */
  PARSE_HOOK_URL?: string;
  PARSE_HOOK_SECRET?: string;
}

const ALIAS = /^u_[a-z0-9]{10}$/;
const MAX_BYTES = 2_000_000; // matches the raw_emails.raw_mime limit

export default {
  // Health check only (used by local tooling). Everything real happens in email().
  async fetch(request: Request): Promise<Response> {
    return new URL(request.url).pathname === "/health" ? new Response("ok") : new Response("Not found", { status: 404 });
  },

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const recipient = message.to.toLowerCase();
    const alias = recipient.split("@")[0] ?? "";
    if (!ALIAS.test(alias)) {
      message.setReject("Unknown address");
      return;
    }
    if (message.rawSize > MAX_BYTES) {
      message.setReject("Message too large");
      return;
    }

    const raw = await new Response(message.raw).text();
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_raw_email`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_alias: alias,
        p_envelope_from: message.from,
        p_envelope_to: recipient,
        p_message_id: message.headers.get("message-id") ?? "",
        p_subject: message.headers.get("subject") ?? "",
        p_raw_mime: raw,
      }),
    });

    if (!response.ok) {
      // Temporary failure: throwing makes the sending server retry later instead of losing the email.
      throw new Error(`ingest failed with HTTP ${response.status}`);
    }
    const result = (await response.json()) as string;
    if (result === "unknown_alias") {
      message.setReject("Unknown address");
      return;
    }

    if (result === "stored" && env.PARSE_HOOK_URL && env.PARSE_HOOK_SECRET) {
      ctx.waitUntil(
        fetch(env.PARSE_HOOK_URL, { method: "POST", headers: { Authorization: `Bearer ${env.PARSE_HOOK_SECRET}` } }).catch(
          () => undefined,
        ),
      );
    }
  },
} satisfies ExportedHandler<Env>;
