@AGENTS.md

# Budget App

## What this is
A multi-user budgeting webapp for me and a few friends in the Philippines.
Core goal: minimize manual transaction input by auto-capturing transactions from
forwarded bank/e-wallet emails (and later SMS), then letting the user confirm them
in a review inbox.

## Stack (must stay within free tiers)
- Next.js (App Router) + TypeScript, deployed on Vercel Hobby
- Supabase: Postgres, Auth, Row-Level Security, Edge Functions (free tier)
- Cloudflare Email Routing + Email Worker (postal-mime) for inbound email
- zod for validation at every boundary (API input, parser output)
- GitHub Actions cron: recurring-transaction generation, due-date reminders,
  daily keep-alive ping (Supabase free projects pause after 1 week idle),
  weekly pg_dump backup
- Tailwind + shadcn/ui; every theme value is a CSS custom property (see Design)

## Local-first
- Everything must run locally before any cloud setup: `supabase start` (Docker) for
  Postgres/Auth/Studio/Edge Functions, `wrangler dev` for the Email Worker.
- A script replays redacted fixtures from `/fixtures/emails` into the local Worker,
  so the full ingestion path is testable without a real domain.

## Domain & accounts
- Domain: jadebonifacio.dev. App at `budget.jadebonifacio.dev`; inbound mail on a
  subdomain (e.g. `u_8f3k2@in.jadebonifacio.dev`) so the root domain's mail is untouched.
- DNS is at Porkbun (Porkbun nameservers + Porkbun email forwarding on the root domain).
  Cloudflare Email Routing requires moving nameservers to Cloudflare: a go-live step, done
  only with the owner, recreating existing records (incl. MX) first.
  The owner actively receives mail at `jade@jadebonifacio.dev` (Porkbun forwarding). Before the
  nameserver switch, recreate it as a Cloudflare Email Routing rule and verify delivery.
- Git for this repo uses the owner's PERSONAL GitHub account (jadesuuu) via the SSH host alias
  `github-personal` (key `~/.ssh/id_ed25519_jadesuuu`) and repo-local `user.name`/`user.email`.
  Remote: `git@github-personal:jadesuuu/budget-app.git`. Never change the global gh CLI login
  (that is a work account) and never push or create repos with it.

## Data access
- supabase-js with the user's session, so RLS always applies. No Prisma (it connects as a
  privileged role and bypasses RLS).
- Multi-step writes (e.g. confirm transaction + resolve duplicate) are Postgres functions called via RPC.
- The service-role key is only for the email parser and cron jobs; they must set `user_id` explicitly.
- RLS policies use `(select auth.uid())` and every `user_id` column is indexed.
- Every user-owned table has a pgTAP test proving user A cannot read or write user B's rows.
- Next.js 16: read `node_modules/next/dist/docs/` before writing Next code (see AGENTS.md).

## Domain model
- Institution: lookup table (not an enum) so banks are data, not code.
  Seeded: GCash, Maya, BPI, BDO, EastWest, Atome (email parsers first), plus Metrobank, UnionBank,
  Security Bank, RCBC, PNB, Landbank, China Bank, PSBank, GoTyme, SeaBank, Tonik, ShopeePay/SPayLater
  (manual entry until parsers exist). Users can add any other institution.
- Account: institution + type = ewallet | savings | debit | credit | bnpl | loan
  (e.g. GCash ewallet, Maya ewallet/savings/Maya Credit, BPI debit/credit, BDO debit/credit,
  EastWest credit, Atome bnpl)
- CreditCard (extends credit Account): statement day, due day, monthly interest rate,
  minimum payment rule (percent + floor). All user-entered from their SOA; never hardcode bank rules.
- Statement: one per card per billing cycle (balance, minimum due, amount paid)
- Loan: principal, rate, term, start date, generated amortization schedule
- InstallmentPlan: for Atome / card installments (total, number of payments, schedule)
- IncomeSource: salary, allowances; amount + frequency
- RecurringRule: generates pending transactions (bills, loan payments, income)
- Transaction:
  - status: pending | confirmed | ignored
  - source: manual | email | sms | recurring | statement
  - dedupe candidates: same account, same amount, timestamps within a short window
- Credit card projection: "minimum-only" payoff simulation (months to payoff, total interest).
  It is an approximation; banks compute interest on average daily balance. Label it as an estimate in the UI.

## Hard rules
- Every user-owned table has `user_id`. RLS is enabled from day one, with policies written in migrations.
- Money is stored as integer centavos (bigint), currency PHP. Never use floats for money.
- Store timestamps as timestamptz (UTC); display in Asia/Manila.
- Never store full card or account numbers: last 4 digits only.
- Never store bank passwords or OTPs. SOA PDF passwords are never stored in plaintext.
- Email ingestion:
  - The Worker only stores the raw email in `raw_emails` (status = pending). No parsing in the Worker.
  - Parsing is a separate, re-runnable job.
  - Each user gets an unguessable inbound alias (e.g. u_8f3k2@domain); unknown aliases are rejected.
  - Allowlist known sender domains; everything else is stored but flagged, never auto-imported.
  - Detect the Gmail forwarding-confirmation email and surface its code in the user's settings page.
- Parsers: one per email template per institution, each tested against redacted fixtures in
  `/fixtures/emails/<institution>/`. LLM extraction is a fallback only when no template matches,
  and its output must pass the same zod schema.

## Design
- Phone-first (most use is on the phone); desktop is a first-class roomier layout.
  Installable as a PWA.
- UI language: English.
- Themes (user-selectable, stored on the profile, each with light + dark):
  Sakura, Strawberry Milk, Bubblegum Pop, Barako, Courtside, Denim, Monochrome, Coal & Brass.
  Themes are never labelled by gender.
- Income vs expense is never conveyed by color alone (signs + icons).
- Design work uses the impeccable and frontend-design skills; see PRODUCT.md and DESIGN.md.
- Theme preview prototype: `design/theme-preview/index.html`.

## How to work
- Propose a plan before large changes; work in small, reviewable steps.
- Run typecheck, lint, and tests before saying a task is done.
- Don't add paid services or dependencies that break the free-tier constraint without asking.

## Commands
Package manager: pnpm. Docker Desktop must be running for any `db:*` command.
- `pnpm dev`: Next.js dev server (http://localhost:3000)
- `pnpm build`: production build
- `pnpm typecheck`: `next typegen` + `tsc --noEmit`
- `pnpm lint`: ESLint
- `pnpm test`: Vitest unit tests (`src/**/*.test.ts`)
- `pnpm db:start` / `pnpm db:stop`: local Supabase (Studio at http://127.0.0.1:54323)
- `pnpm db:reset`: re-apply all migrations + seed locally
- `pnpm db:test`: pgTAP tests in `supabase/tests` (RLS isolation tests live here)
- `pnpm db:types`: regenerate `src/lib/database.types.ts` from the local schema
- New migration: `pnpm exec supabase migration new <name>`

Before saying a task is done: `pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm db:test` if SQL changed).
