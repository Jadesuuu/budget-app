# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router) + TypeScript on Vercel Hobby, Supabase (Postgres, Auth, RLS, Edge Functions), Cloudflare Email Routing + Email Worker, Tailwind + shadcn/ui. Free tiers only. Installable PWA. Must run fully locally (Docker) before any cloud deploy.

## Users
The owner and a few friends in the Philippines, each with their own private data. They hold a mix of e-wallets (GCash, Maya), bank debit/savings accounts (BPI, BDO), credit cards (BPI, BDO, EastWest, Maya Credit), BNPL (Atome) and loans. They mostly use the app on their phones, in short sessions: checking what came in, confirming captured transactions, and seeing what is due. Occasional longer sessions (statements, payoff planning) may happen on desktop.

## Product Purpose
Track spending, income, card statements, installments and loans with as little manual entry as possible. Bank and e-wallet notification emails are forwarded to a per-user inbound address, parsed into pending transactions, and confirmed or ignored in a review inbox. Success: a user's month is accurate after a few taps a day instead of typing every purchase.

## Positioning
Built around Philippine banks' and e-wallets' own notification emails: transactions arrive on their own and the user only reviews them. The review inbox, not a manual entry form, is the product's center.

## Operating Context
- Inbound email: Gmail filters forward bank emails to an unguessable alias; Gmail's forwarding-confirmation code is shown in settings.
- Transactions from email, SMS (later), recurring rules and statements land as `pending` and need confirmation; possible duplicates are flagged.
- Credit cards follow statement day / due day cycles entered from the user's SOA; minimum-only payoff projections are estimates and labelled so.
- Money in PHP (₱), shown in Asia/Manila time.

## Capabilities and Constraints
- Money is integer centavos; never floats.
- Only the last 4 digits of card/account numbers; never passwords, OTPs or plaintext SOA passwords.
- Every user-owned row is protected by RLS.
- Institutions are data, so banks can be added without code changes.
- UI language: English.
- Undecided: SMS capture method; whether "BSP" in the bank list meant another bank.

## Brand Commitments
- User-selectable themes, each with light and dark mode: Sakura, Strawberry Milk, Bubblegum Pop, Barako, Courtside, Denim, Monochrome, Coal & Brass. Pinned by the owner. Themes are never labelled by gender.
- Phone-first, desktop first-class.

## Evidence on Hand
No real transaction data, emails or screenshots yet. All demo amounts, merchants and names in prototypes are synthetic and must be labelled so. Redacted email fixtures will live in `/fixtures/emails`.

## Product Principles
1. Review, don't type: every screen should make confirming captured data faster than entering it.
2. What's due comes before what's spent: upcoming card dues and installments are never buried.
3. Honest numbers: estimates are labelled as estimates; nothing is rounded into a float.
4. Private by default: each person sees only their own money.
5. Personal: the app should feel like theirs, which is why themes are a first-class feature.

## Accessibility & Inclusion
WCAG AA contrast in every theme and mode. Income/expense and status never conveyed by color alone. Large touch targets for one-handed phone use.
