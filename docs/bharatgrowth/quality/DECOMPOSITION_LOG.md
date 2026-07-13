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

## Wave 2 verified, pending merge — 2026-07-13 — Orders

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
- PR and preview: draft PR
  [#3](https://github.com/darshan-Jahagirdar/bharat-growth/pull/3) targets
  `codex/production-hardening-baseline`. Code commit `4f13861` follows the
  pre-extraction test commit `531ea11`.
- Preview isolation: the first automatic preview
  `dpl_EjigdLuusohcSWHq1AL9deRikyiA` predated Wave 2 branch overrides and was
  discarded without app authentication. The next rebuild proved the staging
  client ref but exposed that Supabase's Management API returns existing secret
  keys in a non-usable form; that redacted value had been copied only to the
  Wave 2 Preview branch. No production value was changed.
- Staging credential repair: a new secret key named
  `codex_decomposition_previews` was created only in staging, validated with a
  service-role REST read, stored in macOS Keychain, and scoped to the Wave 2
  Preview branch. It is intended for later decomposition preview branches and
  must be revoked after the decomposition waves. Final deployment
  `dpl_FmhQsYMSWj3gcGip9nEHb3rQRy9p` is READY. All eight loaded client chunks
  contain staging ref `qokaaggeqahayxsybgds`, contain no production ref, and
  contain no framework-overlay marker.
- Visual comparison: the authenticated integration and Wave 2 Orders pages at
  1440x900 matched exactly: 0 changed pixels out of 1,296,000 (0% difference).
- Targeted staging smoke: real Ganesh Tyres sales data rendered; sales and
  purchase tab lazy loading, active counts, row expansion, item math, notes,
  exact WhatsApp URLs, sales payment choices, credit warning, payment reset,
  and a dismissed cancellation confirmation all passed. No uncaught page error
  occurred. An injected Vercel-toolbar Google/FedCM console error was observed
  and is not emitted by the application.
- PO conversion evidence: synthetic `PO/2026-27/00001` for 210,000 paise moved
  from sent to fulfilled, created purchase bill
  `b62f40cb-5eef-4927-a3ab-2b7de559b49a`, and wrote a +1 purchase movement to
  quantity 31. The fulfilled row hid Receive and Cancel actions.
- SO conversion evidence: synthetic walk-in `SO/2026-27/00002` moved from
  reserved to fulfilled, created completed cash invoice
  `BG/2026-27/00002` for 268,800 paise, and wrote a -1 sale movement to quantity
  30. No customer, credit, loyalty, or receipt-delivery side effect was added.
- Pagination note: current staging data does not reach the 50-row Load More
  threshold, so browser pagination was not manufactured by flooding staging.
  The pre-extraction characterization test verifies both SO and PO append calls
  use the current list length and preserve returned rows/has-more state.
- Auth and artifact cleanup: the disposable Wave 2 auth user was deleted; zero
  matching auth users and zero matching `public.users` rows remain. All temporary
  credentials, bypass-cookie jars, env pulls, and screenshots were deleted and
  the isolated browser session was cleared and closed.
- Production result: no production database, deployment, environment, or
  `main` change. Rollback point remains integration commit `e6b58e3`.

## Context re-established — 2026-07-13 — before Wave 3 Products

- Re-read `CODEX_BRIEF.md`, the canonical repository README, decomposition plan
  and log, migration runbook, and bug-fix status before changing Products code.
- Git: `codex/decompose-products` is based on verified integration commit
  `1695da7`. Remote production `main` remains `8c38909`, while remote
  `codex/production-hardening-baseline` remains `1695da7`.
- Supabase: the local link resolves to staging project
  `qokaaggeqahayxsybgds` (`BharatGrowth Staging`). A live read-only migration
  ledger check returned 48 continuous, matching local/remote versions from
  `001` through `048`; production was not linked or modified.
- Workspace: untracked `designs/`, `designs_mobile/`, and
  `docs/bharatgrowth/design/` remain preserved and excluded from this wave.
- Current phase: Wave 3 Products characterization and ownership mapping. The
  Products source remains unchanged; only the pre-extraction test contract is
  in progress.

## Wave 3 characterization checkpoint — 2026-07-13 — Products

- Before ownership and LOC: `src/app/dashboard/products/page.tsx` is 1,004 lines
  and owns authentication/shop context, product/inventory/campaign-tag loading,
  search filtering, flash timers, image validation/upload/removal, inline tag
  creation, add/edit form state, rupee-to-paise payload conversion, bulk upload,
  stock adjustment, and the complete form/table UI.
- Five characterization tests cover the unchanged page's data loads, stock and
  campaign-tag presentation, money output, search filtering, required-field
  validation, create/update payloads and tenant scoping, inline tag creation,
  edit hydration, bulk/stock modal wiring, and image validation.
- Extraction has not started. This checkpoint is the rollback boundary between
  the unchanged Products page and later file movement.

## Wave 3 verified, pending merge — 2026-07-13 — Products

- Branch: `codex/decompose-products`, based on verified integration commit
  `1695da7`; characterization checkpoint commit `49106b3` predates extraction,
  and code extraction commit `9346abd` follows it.
- Current ownership and LOC: the Products route fell from 1,004 to 104 lines and
  now composes focused views and modal wiring. Product money conversion, edit
  hydration, search filtering, constants, and shared types live in a 108-line
  pure module. A 90-line data hook owns the unchanged auth/shop and
  product/inventory/tag loading. A 282-line editor hook owns the unchanged
  add/edit, validation, campaign-tag, image, payload, and save workflows. Six
  named view components own the header, identity fields, commerce fields, image
  field, editor shell, and inventory-aware catalog table; the largest is 150
  lines.
- Behavior contracts exercised: shop-scoped product/inventory/tag reads,
  search across name/SKU/HSN/barcode/category, required-field and image type
  validation, inline campaign tags, add/edit form hydration, integer-paise
  create/update payloads, active/stock toggles, bulk upload wiring, image
  operations, stock modal wiring, and unchanged money/status/stock output.
- Automated checks: 13 Products-focused tests pass, including five contracts
  against the unchanged route and pure helper cases. The full repository has 73
  passing tests across 15 files; strict TypeScript and repository-wide ESLint
  pass with zero warnings. The optimized Next.js build passes all 25 routes,
  including `/dashboard/products`; `git diff --check` passes.
- React review: each new view has one named component, colocated typed props,
  semantic controls, stable product IDs, `next/image`, complete hook dependency
  arrays, and timer cleanup. No compatibility export, schema, copy, styling,
  payload, or workflow was changed.
- PR: draft
  [#4](https://github.com/darshan-Jahagirdar/bharat-growth/pull/4) targets
  `codex/production-hardening-baseline`, never `main`.
- Preview isolation: automatic deployment
  `dpl_5KWdG4dR5xLzzGazLXYMKRuuTq3c` inherited the global Preview production
  Supabase ref and was rejected before authentication. The existing staging
  URL, publishable key, and decomposition-preview secret were then added only
  to the `codex/decompose-products` Preview branch. Rebuild
  `dpl_BZq84YGgEdq3EMLBh5W4S2F2EwTy` is READY; all eight fetched public chunks
  contain staging ref `qokaaggeqahayxsybgds`, contain no production ref, and
  contain no framework-overlay marker.
- Visual comparison: the cleaned authenticated integration and Wave 3 Products
  pages matched byte-for-byte at 1440x900. Their PNG SHA-256 values were equal,
  representing 0 changed pixels out of 1,296,000 (0%).
- Targeted staging smoke: all eight Ganesh Tyres products rendered with no
  framework overlay or uncaught browser error. SKU search, bulk-upload open and
  close, existing tracked stock value 30, add/edit form, required-field and
  invalid-image handling, inline tag creation, and edit hydration passed.
- Database evidence: synthetic product
  `9fabc6dd-101d-4efa-96ad-5fbf8a1d0dd5` was created with cost 123,456 paise,
  selling price 149,999 paise, campaign tag
  `b0d0357d-54bd-45c3-8e1e-dcba022b88e2`, and stock tracking enabled. Editing
  updated its selling price to 159,999 paise. A manual purchase adjustment
  created inventory `98b3a8b4-5f12-43a4-a91f-e36f58cb3d17` and one +3 movement
  ending at quantity 3. The synthetic product and tag were then deleted; both
  verification queries returned zero rows.
- Auth and artifact cleanup: the disposable staging auth user was deleted and
  verified absent; its `public.users` row count is zero. The isolated browser
  cookies were cleared and the browser was closed. Temporary credentials,
  cookie jars, auth state, screenshots, evidence, and helper files are removed
  after the evidence commit.
- Production result: no production database, deployment, environment, or
  `main` change. Rollback point remains integration commit `1695da7`; the
  pre-extraction Wave 3 checkpoint is `49106b3`.
- Known follow-ups kept out of scope: all feature/UI changes, schema changes,
  opportunistic fixes, contract migration 049, and launch-feature work. The
  staging-only `codex_decomposition_previews` key remains scheduled for
  revocation after all decomposition waves.

## Context re-established and Wave 4 characterization checkpoint — 2026-07-13 — Dashboard/progress handoff

- Re-read the canonical README, `CODEX_BRIEF.md`, decomposition plan and full
  log, migration runbook, bug-fix status, behavior contracts, architecture, and
  manual regression checklist before handing work to a new Codex thread.
- Git: `codex/decompose-dashboard-progress` was created from verified integration
  commit `b38e0ad`. A live remote check returned production `main` at `8c38909`
  and `codex/production-hardening-baseline` at `b38e0ad`; fallback tag
  `pre-hardening-8c38909` remains the production rollback point.
- GitHub: PRs #2 Billing/POS, #3 Orders, and #4 Products are merged only into the
  integration branch. Draft PR #1 remains open from integration to `main`; its
  quality, public-smoke, Vercel, and preview-comment checks pass.
- Supabase: the linked project is staging `qokaaggeqahayxsybgds`. A fresh
  `supabase migration list` returned continuous matching local/remote versions
  `001` through `048`. Production was not linked or modified.
- Before ownership and LOC: `src/app/dashboard/page.tsx` remains unchanged at
  973 lines and owns auth/shop resolution, shop-name loading, IST date-range
  construction, dashboard loading, GST export, KPI/progress/chart rendering,
  retention display, khata reminder state/API calls, negative-stock
  reconciliation, action lists, modals, toast timers, and scrollbar styling.
  The existing 672-line `src/lib/dashboard/dashboardQueries.ts` remains reserved
  for Wave 7 data-access decomposition.
- Five characterization tests pass against the unchanged dashboard page. They
  freeze auth/shop loading and the default IST month, preset/custom range
  payloads, metric/progress and storefront output, GST rows and filename,
  khata-reminder endpoint/payload, and negative-stock RPC/refresh behavior.
- Dashboard extraction has not started and no application source file changed.
  This characterization checkpoint is the Wave 4 pre-extraction rollback
  boundary.
- Workspace: untracked user-owned `designs/`, `designs_mobile/`, and
  `docs/bharatgrowth/design/` remain preserved and excluded. No secret value was
  read into documentation or committed.
- Collaboration: the BharatGrowth Google handoff documents Waves 1–3 and the
  verified Wave 3 Slack update is posted in `#bharatgrowth`. No Wave 4 success
  was announced because the wave is not implemented or merged.
- Next action: resume Wave 4 from this checkpoint, extract pure transforms first,
  then controllers/hooks, then focused views. Preserve every current payload,
  date rule, copy string, chart output, focus/modal behavior, RLS assumption, and
  refresh path. Do not modify `dashboardQueries.ts`, schema, features, or styling
  in Wave 4.

## Wave 4 verified, pending merge — 2026-07-14 — Dashboard/progress

- Branch and sequence: `codex/decompose-dashboard-progress` remains based on
  verified integration commit `b38e0ad`; characterization checkpoint `74fc96b`
  predates all application-source extraction. Pure transforms were committed
  first at `d8ec0b1`, controller hooks second at `aac20b0`, and focused views
  last at `3b54d24`.
- Current ownership and LOC: the Dashboard route fell from 973 to 117 lines and
  now composes named views and four controller hooks. Tested date/period,
  top-product-total, donut-color, and GST-filename transforms live in a 105-line
  presentation module. The data, GST export, khata reminder, and stock
  reconciliation hooks are 85, 47, 39, and 66 lines. Ten focused view modules
  own the unchanged header, filters, KPI/progress metrics, charts, anomaly and
  action lists, reminder/reconciliation dialogs, WhatsApp icon, and success
  toast; the largest is 175 lines. `dashboardQueries.ts` remains unchanged at
  672 lines for Wave 7.
- Behavior contracts exercised: auth and separate shop-name resolution; exact
  IST today, seven-day, month, and custom timestamp boundaries; selected-period
  loading; progress/KPI values; chart and empty-state output; storefront link;
  current-month GST rows, alerts, filename, and success state; khata reminder
  endpoint and `{ customer_id }` payload; and the existing negative-stock RPC
  payload followed by the intentionally range-less dashboard refresh.
- Automated checks: all 10 Dashboard-focused tests pass. The full repository
  has 83 passing tests across 17 files; strict TypeScript and repository-wide
  ESLint pass with zero warnings. The optimized Next.js build passes all 25
  routes, including `/dashboard`; `git diff --check` and targeted credential-
  value scans pass.
- React review: the extracted TSX uses named focused components, colocated typed
  props, complete hook dependencies, semantic controls, and stable domain IDs.
  Inherited timer, backdrop-click, and chart-index-key behavior was deliberately
  preserved instead of expanded into an opportunistic change.
- PR and code preview: draft PR
  [#5](https://github.com/darshan-Jahagirdar/bharat-growth/pull/5) targets only
  `codex/production-hardening-baseline`. Source commit `3b54d24` passed GitHub
  `quality`, `public-smoke`, Vercel, and preview-comment checks. Deployment
  `dpl_3s8cLZZ7cF8wCimg8BvLUTHPZ4ba` is READY for that exact commit.
- Preview isolation: exactly three encrypted Preview variables are scoped to
  `codex/decompose-dashboard-progress`: staging Supabase URL, publishable key,
  and server-only secret key. The fetched application chunks contained staging
  ref `qokaaggeqahayxsybgds`, no production ref, and no framework-overlay
  marker. Preview has no WhatsApp access-token or phone-number variable, so the
  reminder endpoint uses its existing simulation path and cannot contact Meta.
- Targeted staging smoke: the Ganesh Tyres dashboard loaded real staging data;
  Today, Last 7 Days, This Month, and Custom filters passed, including a
  2026-07-01 through 2026-07-14 custom range. Progress/KPI cards, revenue and
  top-product charts, storefront link, GST export state, khata hitlist/reminder
  modal, low-stock list, and negative-stock anomaly all rendered and operated
  without a framework overlay. Stock reconciliation accepted +3 against the
  synthetic -2 anomaly, removed the anomaly, and displayed quantity 1.
- Approved reminder gate: Darshan authorized one staging reminder invocation.
  A disposable staging customer was used once; the protected Wave 4 deployment
  returned HTTP 200 and logged `SIMULATION MODE` for template `bg_khata_v1`.
  No external WhatsApp/Meta request was made and no second invocation occurred.
- Visual comparison: integration and Wave 4 were captured from the same tab,
  authenticated fixture, 1440x900 viewport, and cleaned dashboard state. Both
  PNGs were exactly 55,827 bytes with SHA-256
  `a13dc556ac8bca1accbfa2c15d3568220f4e89f791f30503c110799eeb9ce85c`;
  the byte comparison is identical, representing zero visual difference.
- Staging cleanup and credential containment: the disposable customer, auth
  user, profile, reconciliation movement, browser sessions, Keychain fixtures,
  screenshots, auth handoff, and helper scripts were removed. The product and
  inventory values plus original timestamps were restored exactly; Auth phone,
  OTP, and callback settings returned to baseline. The already-disabled legacy
  staging service-role credential still returns HTTP 401, while the modern
  scoped staging secret remains healthy and unique. Because the exposed legacy
  path was already disabled and its signing key revoked, no disruptive key
  replacement was needed in this wave; Darshan will rotate all remaining keys
  before the first sale, and the decomposition-only scoped secret remains due
  for revocation after the waves.
- Runtime and production result: the Wave 4 preview reported no error/fatal
  runtime logs in the smoke window. Production `main`, production Supabase,
  production Vercel, production environment variables, and production data were
  never changed.
- Rollback points: integration `b38e0ad` for the whole wave and characterization
  checkpoint `74fc96b` for the pre-extraction Dashboard state.
- Known follow-ups kept out of scope: all feature, schema, query-facade, copy,
  styling, payload, visual, focus, keyboard, RLS, stock-rule, workflow, and
  opportunistic cleanup changes; migration 049; production rollout work; and
  the full pre-sale manual hard-test checklist.

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
