---
version: 1
slug: "design-theme-preview-index-html"
primary_target: "design/theme-preview/index.html"
related_targets: []
---

## Scope
Theme preview prototype: the Home screen (review inbox, due soon, accounts, month) rendered in all 8 pinned themes, light and dark, phone and desktop. Mode: Operate. Its tokens and components carry into the Next.js app.

## Audience and job
Owner and friends (PH), phone-first. Job here: choose themes and judge the shell before the real app is built. Job inside the screen: clear captured transactions, see what's due.

## Direction contract
THESIS: Home leads with the review inbox (captured transactions waiting for a tap), not a balance hero or donut chart. Refuses the category default of total-balance-first dashboards.
OWN-WORLD: One shared shell; each pinned theme lends only type, palette, density and one signature move. Sakura: petal-cut corners and a petal drift on confirm. Strawberry Milk: chunky milk-carton cards, soft rounded type. Bubblegum Pop: sticker badges with die-cut white outline. Barako: receipt-edge cards and stamp labels. Courtside: scoreboard numerals and a court-line divider. Denim: stitched inset seams and a leather-patch label. Monochrome: weight-only hierarchy, no tint. Coal & Brass: engraved brass plate for the due amount.
STORY: User sees how many items await review, confirms or ignores each in one tap or swipe, then sees the next card due and account balances.
FIRST VIEWPORT: Phone 390px: header with month and review count; front inbox card full width (merchant, large amount, account ••last4, "from BDO email · 8:42 PM", category), Ignore and Confirm buttons in thumb reach; next item peeks; Due soon begins below; bottom tab bar with center Add. Desktop: left nav rail, center inbox list + selected detail, right column due soon and accounts.
FORM: Owner-pinned theme set (no concept-seed roll; pinned directions beat the roll). Shell: standard mobile tab bar / desktop rail.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
Final theme-specific confirm celebrations beyond the preview; SMS source chip wording.
