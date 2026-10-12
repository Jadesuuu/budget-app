---
target: new budgeting screens
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\jade.bonifacio\\Desktop\\PProjects\\budget-app\\src\\app\\(app)\\spending\\page.tsx"
target_fingerprint: "sha256:1c54571cb002ff99ac219b6bac9aa9e2a47fa9962f2b5f3a9536ae743121bf0e"
target_path: "C:\\Users\\jade.bonifacio\\Desktop\\PProjects\\budget-app\\src\\app\\(app)\\spending\\page.tsx"
timestamp: 2026-10-12T10-12-18Z
slug: src-app-app-spending-page-tsx
---
# Critique: new budgeting screens (Today card, Spending, Limits, Goals, Alerts, Mark as paid, bill form)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Paid rows vanish silently |
| 2 | Match real world | 3 | Five overlapping money terms |
| 3 | User control | 2 | Mark as paid has no Undo; Limits form one Save at bottom |
| 4 | Consistency | 2 | Home meter = pay period, Spending meter = month; ISO dates |
| 5 | Error prevention | 3 | Suggested limit ignores debt payments |
| 6 | Recognition over recall | 2 | Five figures to reconcile across screens |
| 7 | Flexibility | 2 | No inline limit setting; no quick goal amounts |
| 8 | Minimal design | 2 | Spending 9 sections ~4,700px; Today card 5 lines |
| 9 | Error recovery | 2 | Over/short states give no next step |
| 10 | Help | 3 | Honest but long explanations |
| Total | | 24/40 | Acceptable |

Design specificity: logic is product-specific (paydays, dues before payday, transfers excluded); presentation is a generic fintech dashboard stack. Detector: 0 findings. Browser: no errors/overflow; undersized targets (Mark as paid 32px, inline links 19-28px, avatar/eye 38px).

## Priority issues
1. [P0] Today card pushes Confirm below the fold and breaks Thumb Rule + Due Before Spent. Fix: one-line strip under month title; Home = strip, To review, Due soon; Due soon back in desktop right column.
2. [P1] Spending has no hero and buries setup. Fix: period allowance hero; Before payday; Where it went with inline limits; chart with per-period pace; Patterns disclosure; merge plan + limits into /spending/plan.
3. [P1] Three disagreeing "spendable" numbers. Fix: show safe-to-spend only when cash can't cover the plan; suggestion subtracts debt payments.
4. [P1] Mark as paid: tall rows, 32px buttons, no Undo, minimum vs full ambiguous, focus lost. Fix: minimum / in full / other, instant commit with Undo toast, 44px.
5. [P2] Limits page 30-control wall. Fix: sort by spend, hide zero-spend, save per row, last-month placeholder, labelled toggles.

## Persona red flags
Casey: Confirm off-screen, small targets, Saves at page bottoms. Sam: whole-card link, unlabelled checkboxes, near-limit by weight only, focus loss. Jordan: setup lands at page bottom, terms undefined, alert prefs look active before subscribing.

## Minor
NETFLIX.COM raw caps; em dash as minus; date wraps mid-word; no "so far" marker on current month bar; three accent primaries on Settings.

## Questions
Left today under the review count? Calendar-month chart for semi-monthly pay? Auto-close bills from confirmed card payments?
