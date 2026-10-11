# Deploying Budget

Everything runs on free tiers: Supabase (database, auth), Vercel (web app), Cloudflare (DNS, inbound
email Worker). Steps marked **you** need the owner's own accounts; never use the work GitHub/gh login.

## 1. Supabase

1. **You:** supabase.com → sign in with the personal GitHub (jadesuuu) → New project.
   Name `budget-app`, region **Southeast Asia (Singapore)**, a strong database password saved in a
   password manager (it is not stored anywhere in this repo).
2. **You:** `pnpm exec supabase login` (opens the browser), then
   `pnpm exec supabase link --project-ref <ref>` and enter the database password.
   The ref is in the dashboard URL: `supabase.com/dashboard/project/<ref>`.
3. `pnpm exec supabase db push --dry-run`, check the list, then `pnpm exec supabase db push`.
4. Auth settings (site URL, redirect URLs, Resend SMTP, sign-in email template) live in
   `supabase/production/supabase/config.toml`. Put the Resend API key in the gitignored
   `supabase/production/supabase/.env` as `RESEND_API_KEY=re_...` (domain must be verified in Resend first), then:
   `pnpm exec supabase config diff --workdir supabase/production --project-ref <ref>` to preview and
   `pnpm exec supabase config push --workdir supabase/production --project-ref <ref>` to apply.
   Only declared settings change. **Never** push the main `supabase/config.toml` to production: it holds
   local-development values (localhost URLs, relaxed limits).
5. Invite people by adding their emails to `ALLOWED_SIGNUP_EMAILS` in Vercel, then redeploy.
6. Dashboard → Project Settings → API keys: copy the **publishable** key and the **secret** key for step 2.

## 2. Vercel

1. **You:** vercel.com → sign in with the personal GitHub → Add New Project → import `Jadesuuu/budget-app`.
   Framework: Next.js (auto). Install/build commands: defaults (pnpm is detected from `packageManager`).
2. Environment variables (Production):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key (server only) |
   | `INBOUND_EMAIL_DOMAIN` | `in.jadebonifacio.dev` |
   | `ALLOWED_SIGNUP_EMAILS` | comma-separated invited emails |
   | `PARSE_JOB_SECRET` | 48+ random hex chars (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) |

3. Deploy, then Settings → Domains → add `budget.jadebonifacio.dev` (Vercel shows the CNAME to create).

## 3. Cloudflare DNS and email (moves DNS off Porkbun)

Porkbun stays the registrar; only the nameservers change. Existing mail at `jade@jadebonifacio.dev` must
keep working, so it is recreated in Cloudflare before the switch.

1. **You:** cloudflare.com → Add a domain → `jadebonifacio.dev` → Free plan. Review the imported DNS records
   against Porkbun's DNS page; add anything missing. Remove Porkbun's forwarding MX (`fwd1/fwd2.porkbun.com`)
   only after step 3.4.
2. Add `CNAME budget → cname.vercel-dns.com` (DNS only / grey cloud), as Vercel's domain page shows.
3. Email → Email Routing:
   1. Enable for `jadebonifacio.dev`; add the personal Gmail as a destination and verify it.
   2. Rule: `jade@jadebonifacio.dev` → that Gmail (replaces Porkbun forwarding).
   3. Enable Email Routing for the subdomain `in.jadebonifacio.dev`; catch-all → Send to Worker
      `budget-email-ingest` (after step 4).
   4. Accept Cloudflare's MX/SPF records for both.
4. **You (Porkbun):** turn off DNSSEC if it's on, then set the nameservers to the two Cloudflare shows.
   Propagation is usually under an hour. Then send a test email to `jade@jadebonifacio.dev`.

## 4. Email Worker

1. **You:** `pnpm exec wrangler login`.
2. `pnpm exec wrangler deploy -c workers/email-ingest/wrangler.jsonc`
3. Secrets (each prompts for the value):
   `pnpm exec wrangler secret put SUPABASE_URL -c workers/email-ingest/wrangler.jsonc` (and likewise
   `SUPABASE_SECRET_KEY`, `PARSE_HOOK_URL` = `https://budget.jadebonifacio.dev/api/jobs/parse-emails`,
   `PARSE_HOOK_SECRET` = the same value as `PARSE_JOB_SECRET`).
4. The Worker's 15-minute schedule re-runs the parse job and keeps Supabase from pausing.

## 5. Check it works

- Sign in at `https://budget.jadebonifacio.dev`, add to home screen.
- Settings → Phone capture: create a link, set up the Android forwarder, receive a real bank text.
- Settings → Set up email: Gmail forwarding code appears, filter download works.
- `jade@jadebonifacio.dev` still delivers to Gmail.
