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

## Wave 1 in progress — 2026-07-12 — Billing/POS

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
- Manual checks: pending staging preview. Cash/UPI/card/credit, barcode/focus,
  print, stock, khata/repayment, loyalty, SO reserve, and modal blocking have not
  yet been claimed as manually passed.
- Visual comparison: pending. Local server binding was sandbox-denied, and the
  required port escalation was unavailable because the Codex allowance was
  exhausted. No bypass was attempted.
- Commit / PR / preview: pending. The wave must not merge until local or preview
  browser verification, CI, Vercel staging preview, visual comparison, and the
  targeted manual smoke pass.
- Production result: no production change.
- Rollback point: integration commit `0ad2fb6`; production fallback remains
  `pre-hardening-8c38909`.
- Known follow-ups kept out of scope: all feature changes, schema changes,
  opportunistic bug fixes, contract migration 049, and launch-feature work.

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
