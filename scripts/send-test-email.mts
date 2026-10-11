// Replays .eml files through the LOCAL email Worker, addressed to a user's real inbound alias.
// Exercises the full path: Worker -> raw_emails -> parse job -> Review.
//
//   pnpm email:send fixtures/emails/_synthetic/gmail-forwarding-confirmation.eml
//   pnpm email:send --user someone@example.com --fresh fixtures/emails/bpi/*.eml
//
// --fresh gives each send a new Message-ID, so the same file can be replayed (otherwise it is a duplicate).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const userIndex = args.indexOf("--user");
const email = (userIndex >= 0 ? args[userIndex + 1] : "jadesuuu@gmail.com").toLowerCase();
const files = args.filter((a, i) => !a.startsWith("--") && i !== userIndex + 1);
if (files.length === 0) throw new Error("Pass one or more .eml files");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to use a non-local database: ${url}`);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false } });
const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "in.jadebonifacio.dev";
const worker = process.env.EMAIL_WORKER_URL ?? "http://localhost:8787";

const listed = await db.auth.admin.listUsers({ perPage: 1000 });
if (listed.error) throw new Error(listed.error.message);
const user = listed.data.users.find((u) => u.email === email);
if (!user) throw new Error(`No local user ${email}. Sign in once or run pnpm demo.`);
const profile = await db.from("profiles").select("inbound_alias").eq("user_id", user.id).single();
if (profile.error) throw new Error(profile.error.message);
const to = `${profile.data.inbound_alias}@${domain}`;

for (const file of files) {
  let raw = readFileSync(file, "utf8").replace(/\r?\n/g, "\r\n").replace(/u_test000000@in\.jadebonifacio\.dev/g, to);
  if (fresh) raw = raw.replace(/^Message-ID:\s*<([^>]+)>/im, (_m, id: string) => `Message-ID: <${Date.now()}.${id}>`);
  const from = /^From:.*?<([^>]+)>/im.exec(raw)?.[1] ?? /^From:\s*(\S+@\S+)/im.exec(raw)?.[1] ?? "unknown@example.com";
  const res = await fetch(`${worker}/cdn-cgi/local/email?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    method: "POST",
    body: raw,
  });
  console.log(`${file}: ${res.status} ${(await res.text()).trim()}`);
}
