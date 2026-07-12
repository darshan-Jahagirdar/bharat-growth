# Decomposition Log

## Baseline preservation — 2026-07-11

- Production fallback: `pre-hardening-8c38909` at `8c38909`.
- Local intended-work checkpoint: `4b7424a`.
- Working branch: `codex/production-hardening-baseline`.
- Excluded local file: `.claude/settings.local.json`.
- Secret scan: only placeholder environment-variable names detected in
  `.env.example`; no credential value intentionally staged.
- Baseline size: 24,132 frontend lines; 7,938 Supabase SQL lines.
- Remote publish: checkpoint and verified baseline commits pushed to draft PR
  [#1](https://github.com/darshan-Jahagirdar/bharat-growth/pull/1).
- Supabase staging: dedicated project `qokaaggeqahayxsybgds` created and linked;
  production project `vyycczqhvsgkiqtxxxos` was never linked or modified.
- Local E2E uses installed system Chrome while CI installs pinned Chromium on
  the GitHub runner.
- Automated baseline: 33 tests across 7 files pass; strict typecheck, ESLint, and
  the Next.js production build pass. The build generated all 25 routes.
- Security baseline: committed development credentials removed, migration 011
  neutralized, GSTIN checksum validation added, and Anthropic vision model moved
  to the officially documented `claude-sonnet-5` identifier.
- Staging migration attempt found a fresh-install ordering defect before any
  ledger entry was written: migration 001 referenced `public.users`, created in
  migration 002. The helper definition was moved after the table creation and a
  regression test was added.
- Migrations 001-046 then applied successfully to the dedicated staging project
  `qokaaggeqahayxsybgds`; the local and remote migration ledgers matched exactly.
- Linked-schema lint reported no errors. Migration 047 corrects the tenant
  guard's volatility declaration; two historical unused-variable warnings remain
  non-blocking cleanup items.
- The first synthetic seed attempt exposed nondeterministic loyalty ordering when
  multiple rows shared `created_at`; random UUID order could make a valid redeem
  appear negative. Migration 048 now derives balance from the sum of prior points
  under the existing advisory lock.
- Staging seed then completed with 3 shops, 24 products, 9 customers, 12
  inventory rows, 10 loyalty rows, 3 invoices, and all campaign rules inactive.
- Anonymous expand-phase checks: public receipt RPC returned one seeded invoice;
  customers remained hidden; legacy shop/product/invoice fields remain visible
  until the post-application contract migration 049.
- Browser baseline: Playwright public smoke passed; direct agent-browser check
  returned `OK` for framework overlays, `HAS_CONTENT` for body content, and
  rendered the expected landing navigation/CTA elements.
- Vercel preview `dpl_AropTWZdDSNN7ZJ7pLnuVDr84vKj` is `READY` for commit
  `73786af`. Branch-scoped variables use the staging Supabase URL, publishable
  key, and modern secret key. A browser bundle scan found the staging ref and no
  production ref.
- The first GitHub `quality` run passed typecheck, lint, and all 33 tests but its
  build step lacked required public Supabase configuration. CI now supplies
  non-secret placeholders scoped only to `npm run build`; it does not use a live
  database or deployment credentials.
- Staging legacy-key remediation: JWT-based `anon`/`service_role` API keys were
  disabled and the previous HS256 signing key was revoked after modern-key
  verification. The legacy service-role credential now returns HTTP 401; modern
  secret admin access and publishable receipt access both still pass.
- Post-remediation local gate: strict typecheck, ESLint, 33 unit tests, the
  25-route production build, and the Playwright public smoke test all pass.
  Linked schema lint has no errors and retains two documented historical
  unused-variable warnings.
- Follow-up commit `eb28f6d` passed both GitHub jobs (`quality` and
  `public-smoke`). Vercel deployment `dpl_5L6bJqEB2aHQaifK1KE8WoAQHyqT` is
  `READY`, reported no error/fatal runtime logs, rendered the login controls
  without a framework overlay, and again exposed only the staging project ref
  in its public bundle.

## Context re-established — 2026-07-12

- Re-read the canonical repository brief, plan, log, migration runbook, and bug
  status. Live evidence below replaces remembered state.
- Git: branch `codex/production-hardening-baseline` at `eb28f6d`; `main`,
  `origin/main`, and fallback tag `pre-hardening-8c38909` all resolve to
  `8c38909`.
- GitHub: draft PR
  [#1](https://github.com/darshan-Jahagirdar/bharat-growth/pull/1) targets
  `main`, is cleanly mergeable, and has successful `quality`, `public-smoke`,
  and Vercel checks.
- Vercel: preview `dpl_5L6bJqEB2aHQaifK1KE8WoAQHyqT` is `READY` for
  `eb28f6d`, uses branch-scoped staging Supabase variables, and has no recorded
  error/fatal runtime logs. Production remains `dpl_9dTAW9EXiKNpreMT6WKL2JyYryxc`
  at `8c38909`.
- Supabase: the local link is staging `qokaaggeqahayxsybgds`; local and remote
  migration ledgers match exactly for 001-048. Linked lint has no errors and the
  same two historical unused-variable warnings.
- Workspace: retained the two verified evidence-doc edits and the authoritative
  `CODEX_BRIEF.md` for this documentation checkpoint. Untracked design packages
  under `designs/`, `designs_mobile/`, and `docs/bharatgrowth/design/` are
  preserved but excluded from the checkpoint and decomposition scope.
- Drive: the shared-folder `AGENTS.md` and `PROJECT_HANDOFF.md` currently describe
  the separate Taste project, so they were not used as BharatGrowth instructions
  and will not be overwritten. A BharatGrowth-specific status artifact is needed.
- Current phase: baseline documentation checkpoint before decomposition.
- Planned next wave: Billing/POS. Start is blocked until Darshan resolves whether
  each wave is production-deployed before the next, as required by the current
  per-wave gate, or all waves merge to the hardening integration branch with
  staging smoke before the single pre-launch production rollout in the brief.

## Process decision — 2026-07-12

- Darshan approved the integration/staging branch model.
- Each wave gets an independently revertible PR into
  `codex/production-hardening-baseline`, followed by CI, staging preview, visual
  comparison, and targeted manual smoke before merge.
- Production `main` remains unchanged until all seven waves and all approved
  launch features are staging-verified. The final integration result then merges
  to `main` in one controlled pre-launch rollout.
- The next action is Wave 1: Billing/POS characterization and ownership mapping.

## Wave 1 verified, pending merge — 2026-07-13 — Billing/POS

- Branch: `codex/decompose-billing-pos`, created from verified integration commit
  `0ad2fb6`. Production `main`, production Supabase, and production Vercel remain
  untouched.
- Before ownership and LOC: `src/app/billing/page.tsx` owned shop loading,
  realtime pending-order polling, both debounced searches, persistence payload
  construction, payment/save/SO orchestration, customer actions, keyboard
  wiring, and the complete 1,412-line view.
- Current ownership and LOC: the page is 739 lines and remains the business
  workflow controller. Five focused view components own the existing header,
  customer strip, product search, line-item grid, and totals/actions footer.
  Tested pure builders own invoice/loyalty/SO payloads; dedicated hooks own
  debounced search and shop/realtime context. Payment cycle labels are shared in
  one constant module.
- Behavior contracts exercised: integer-paise invoice and item payloads,
  customer snapshots, loyalty earn/running-balance rules, walk-in behavior,
  valid-product SO filtering, current payment cycle, global function keys,
  modal interaction lock, input-safe row shortcuts, barcode minimum length,
  customer/product debounce timing, stale-response rejection, view action
  wiring, totals, document type, and pending-order control.
- Automated checks: 34 focused Billing/POS tests pass. The full repository has
  51 passing tests across 11 files; strict TypeScript and ESLint pass with zero
  warnings. The optimized Next.js build passes and generates all 25 routes,
  including `/billing`.
- Safety checks: `git diff --check` passes. A targeted secret scan found only
  expected configuration names/placeholders and SQL role grants; no credential
  value was introduced. Untracked design packages remain excluded.
- Preview isolation gate: the first PR preview
  `dpl_9EmKXPDG1ybXybefHcAmTtLDEPK7` was stopped before authentication because
  its client bundle contained production ref `vyycczqhvsgkiqtxxxos` and not
  staging. Vercel staging variables had been scoped only to the integration
  branch. The same three staging values were copied as encrypted overrides for
  `codex/decompose-billing-pos`; no production variable was changed. Rebuilt
  preview `dpl_7wXKjeFeJAGKSCACR8RHgJ5aqgYW` is `READY`, and all seven loaded
  application chunks contain staging ref `qokaaggeqahayxsybgds` with no
  production ref.
- Staging Auth safety: the stable Wave 1 branch alias was added as the only
  redirect allowlist entry on project `qokaaggeqahayxsybgds`. Disposable test
  users were provisioned out of band, linked to synthetic Ganesh Tyres data,
  and deleted after verification. Temporary key, credential, link, and helper
  files were deleted. No production authentication was attempted.
- Targeted manual smoke: Billing rendered Ganesh Tyres in tax-invoice mode with
  no framework overlay or captured console errors. F2/F3 focus, real staging
  customer/product search, cart insertion, plus/minus quantity shortcuts, F8
  payment cycling, F4 reset, customer/loyalty rendering, Sales Order reserve,
  and a walk-in cash save passed. Database evidence: reserved
  `SO/2026-27/00001` for 448,000 paise and completed cash invoice
  `BG/2026-27/00001` for 448,000 paise. CEAT stock correctly remained 24 because
  that seed product is not stock tracked. Full cash/UPI/card/credit, print,
  khata/repayment, and tracked-stock regression remains part of the final manual
  hard-test checklist before sale.
- Visual comparison: the pre-wave integration Billing page and Wave 1 Billing
  page matched exactly at the same viewport: 0 changed pixels out of 810,240
  (0% difference).
- Commit / PR / preview: commit `d2ca49e` is pushed in draft PR
  [#2](https://github.com/darshan-Jahagirdar/bharat-growth/pull/2), targeting
  `codex/production-hardening-baseline`. GitHub `quality`, `public-smoke`,
  Vercel, and preview-comment checks all pass. The corrected staging preview is
  `dpl_7wXKjeFeJAGKSCACR8RHgJ5aqgYW`.
- Production result: no production change.
- Rollback point: integration commit `0ad2fb6`; production fallback remains
  `pre-hardening-8c38909`.
- Known follow-ups kept out of scope: all feature changes, schema changes,
  opportunistic bug fixes, contract migration 049, and launch-feature work.

## Context re-established — 2026-07-13 — before Wave 2 Orders

- Re-read `CODEX_BRIEF.md`, the behavior contracts, the decomposition plan, and
  the current decomposition log before changing Orders code.
- Git: `codex/decompose-orders` was created from verified integration commit
  `e6b58e3`. Remote `main` remains `8c38909`; fallback tag
  `pre-hardening-8c38909` dereferences to the same commit.
- Supabase: the local project link is staging `qokaaggeqahayxsybgds`. The
  Supabase CLI 2.109.0 connected but did not render migration-list rows, so the
  official read-only Management API was used instead. It returned exactly 48
  continuous ledger versions, `001` through `048`, with `048` named
  `loyalty_balance_sum`.
- Workspace: untracked `designs/`, `designs_mobile/`, and
  `docs/bharatgrowth/design/` remain preserved and excluded.
- Current phase: Wave 2 Orders characterization and ownership mapping. No
  Orders source has been changed at this checkpoint.

## Wave 2 characterization checkpoint — 2026-07-13 — Orders

- Before ownership and LOC: `src/app/dashboard/orders/page.tsx` is 1,127 lines
  and owns authentication/shop context, eager sales-order loading, lazy
  purchase-order loading, pagination, conversion and cancellation orchestration,
  status presentation, date and WhatsApp formatting, both order tables,
  expansion rows, the conversion modal, and toast output. The existing
  `src/lib/orders/orderQueries.ts` data-access module is 431 lines and remains
  unchanged in this wave.
- Five characterization tests pass against the unchanged page. They freeze the
  initial sales load and one-time purchase lazy load, list-length pagination
  offsets, expanded item/note output, sales and purchase WhatsApp payloads,
  payment selection, conversion reloads, confirmation copy, and shop-scoped
  cancellation arguments.
- Extraction has not started. This checkpoint is the rollback boundary for
  distinguishing the pre-extraction safety net from subsequent file movement.

## Wave 2 implementation verified locally, pending preview — 2026-07-13 — Orders

- Branch: `codex/decompose-orders`, based on verified integration commit
  `e6b58e3`; characterization checkpoint commit `531ea11` predates extraction.
- Current ownership and LOC: the Orders route fell from 1,127 to 82 lines and
  now composes focused views. A 207-line controller hook owns the unchanged auth,
  eager/lazy loading, pagination, conversion, cancellation, and toast workflows.
  Shared presentation helpers own status configuration, payment choices, dates,
  actionable-state rules, phone normalization, and WhatsApp URL construction.
  Focused components own the header/tabs, sales panel, purchase panel, shared
  item expansion, status badge, pagination button, conversion dialog, and toast.
  The largest focused component is 248 lines. The 431-line query module remains
  unchanged for the later data-access wave.
- Behavior contracts exercised: sales-first and one-time purchase lazy loading,
  list-length pagination offsets, shop-scoped cancellation calls and confirmation
  text, status/action visibility, expanded item math and notes, exact WhatsApp
  message content and phone normalization, payment selection, conversion RPC
  arguments, reloads, and success output.
- Automated checks: 9 Orders-focused tests pass. The full repository has 60
  passing tests across 13 files; strict TypeScript and repository-wide ESLint
  pass with zero warnings. The optimized Next.js build passes all 25 routes,
  including `/dashboard/orders`.
- React review: component boundaries, hook dependencies, stable keys, named
  exports, prop typing, and semantic controls pass the project checklist.
  Pre-existing toast-timer cleanup and title-only icon-button accessibility were
  intentionally not changed inside this decomposition-only wave.
- Manual staging smoke, visual comparison, PR, and preview isolation remain
  required before merge. Production remains unchanged.

## Wave entry template

```text
Date / domain:
Before ownership and LOC:
After ownership and LOC:
Behavior contracts exercised:
Automated checks:
Manual checks:
Visual comparison:
Commit / PR / preview:
Production result:
Rollback point:
Known follow-ups kept out of scope:
```
