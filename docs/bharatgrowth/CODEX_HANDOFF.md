# BharatGrowth Codex Handoff

Last verified from disk and live read-only checks: 2026-07-15
(Asia/Kolkata).

This is the first file the next Codex task must read, completely. It is a
continuation handoff, not permission to re-plan the product. Do not trust
remembered, compacted, or conversational state. Re-derive every drift-prone fact
listed below before acting. If local disk, remote Git, GitHub, Supabase, Vercel,
Google Drive, or Slack contradicts this handoff, stop and report the mismatch.

## 1. What BharatGrowth is

BharatGrowth is a multi-tenant vertical SaaS application for single-store Indian
SMBs, initially tyre shops, sweet stalls, garment stores, and general retail.
Its wedge is fast desktop, keyboard-driven GST billing. Its intended retention
moat is consent-aware WhatsApp receipts, khata reminders, and repurchase-cycle
campaigns. The same shop tenant connects catalog, inventory, purchasing,
sales/purchase orders, owner analytics, a public storefront, online checkout,
and digital receipts.

The protected operator workspace is deliberately desktop-first because staff
may process 20–200 bills a day. The public storefront and receipt are
deliberately mobile-oriented because customers reach them from links and
WhatsApp.

Read the full source-backed product map in
[`product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](product/FEATURE_AND_BEHAVIOR_INVENTORY.md).
It distinguishes implemented behavior from planned/marketed capability. Do not
turn a landing-page claim or roadmap item into application behavior during
decomposition.

## 2. What we are doing, why, and how

### What

We are production-hardening the existing application and decomposing its
largest mixed-responsibility surfaces through seven small, independently
revertible waves. Waves 1–5 are merged into the integration branch. Wave 6 is
Storefront. Wave 7 is data-access/query facade decomposition.

### Why

Large pages made business rules, payloads, focus behavior, views, and provider
effects hard to understand and unsafe to change. The goal is to make ownership
clearer and behavior easier to test before the first real customer. The goal is
not a redesign, feature sprint, or schema rewrite.

### How

For each domain:

1. Re-derive state and stop on contradiction.
2. Characterize the unchanged behavior and commit the rollback checkpoint.
3. Extract tested pure transforms first.
4. Extract controllers/hooks second.
5. Extract focused views last.
6. Run focused/full automated gates.
7. Use a branch-scoped staging preview for bounded browser, API/database, and
   visual checks.
8. Clean every temporary user/profile/fixture/session/variable/deployment and
   verify cleanup.
9. Update repository docs, the shared Google handoff, and `#bharatgrowth` with
   exact evidence.
10. Merge only into `codex/production-hardening-baseline`.

No decomposition wave may change a feature, schema, migration, query facade
outside Wave 7, copy, styling, payload, visual output, focus, keyboard behavior,
RLS, stock rule, consent rule, provider workflow, route, or public contract.

## 3. Roles and working relationship

- Darshan owns product direction, priority, scope, risk decisions, and approvals.
- Codex / Sol owns careful execution, backend/cross-cutting work, verification,
  cleanup, and durable handoff state.
- Claude Code is the architecture/review/frontend counterpart; its audits are
  inputs, not a substitute for current source verification.
- Perplexity is used for deep research and Gemini for broad exploratory questions
  when Darshan asks.

The next Codex task must feel like the same operator continuing this job: direct,
evidence-based, cautious with provider state, and unwilling to silently widen
scope. Do not make Darshan repeatedly explain the app or collaboration process.

## 4. Locked safety decisions

- Production `main` is not an editing branch. Do not push, merge, deploy,
  migrate, configure, smoke with mutations, or rotate anything in production.
- Immutable production fallback tag: `pre-hardening-8c38909` at `8c38909`.
- Integration/staging branch: `codex/production-hardening-baseline`.
- Each remaining wave branches from a freshly verified remote integration SHA
  and PRs only back to integration.
- Preserve and exclude the user-owned untracked directories `designs/`,
  `designs_mobile/`, and `docs/bharatgrowth/design/`. Do not read, stage,
  clean, move, summarize, or edit them.
- Never print, paste, document, invent, or request secrets, environment values,
  OTPs, passwords, phone test fixtures, provider tokens, or private keys.
- A user login/takeover gate is allowed only on a verified staging-only preview.
  Darshan enters private values himself and tells Codex when signed in.
- The raw-ten-digit staging phone workaround was temporary, preview-only, and
  removed. Do not commit it. Current source retains India `+91` normalization;
  auth/provider redesign is separate future work.
- Staging fixtures must be synthetic or explicitly approved, uniquely
  identifiable, minimal, and cleaned with readback verification.
- Do not claim a gate passed because code exists. Record exact current evidence.
- Stop rather than choosing a new route when an approved doc conflicts with
  current instructions.

## 5. Required reading order in a fresh task

Read every file completely, in this order, before Git/service commands or
application changes:

1. `CLAUDE.md`
2. `docs/bharatgrowth/CODEX_BRIEF.md`
3. `docs/bharatgrowth/COLLABORATION_WORKFLOW.md`
4. `docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md`
5. `docs/bharatgrowth/README.md`
6. `docs/bharatgrowth/architecture/CURRENT_ARCHITECTURE.md`
7. `docs/bharatgrowth/quality/BEHAVIOR_CONTRACTS.md`
8. `docs/bharatgrowth/quality/DECOMPOSITION_PLAN.md`
9. `docs/bharatgrowth/quality/DECOMPOSITION_LOG.md`
10. `docs/bharatgrowth/quality/BUG_FIX_PLAN.md`
11. `docs/bharatgrowth/quality/FIX_CHECKLIST.md`
12. `docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`
13. `docs/bharatgrowth/operations/DEPLOYMENT_AND_ROLLBACK.md`
14. `docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`
15. `docs/bharatgrowth/setup/MAC_MIGRATION_CHECKLIST.md`

Root `ROADMAP.md`, `docs/BUG_FIX_PLAN.md`, `docs/CURRENT_ARCHITECTURE.md`,
`docs/FIX_CHECKLIST.md`, and `docs/MAC_MIGRATION_CHECKLIST.md` are historical
inputs. Their canonical-current links and status banners take precedence over
old unchecked boxes or older project references.

## 6. Exact verified checkpoint before this handoff-doc PR

The docs-only handoff PR is expected to advance the integration branch without
changing application source. Therefore the next task must re-derive the current
integration SHA. The exact application-source checkpoint beneath that docs-only
change is `907dfe3b4f02bc872264c4b983d6a59aab747423`.

### Git

- Repository: `darshan-Jahagirdar/bharat-growth`.
- Production `origin/main`:
  `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
- Verified integration before this docs-only handoff:
  `origin/codex/production-hardening-baseline` =
  `907dfe3b4f02bc872264c4b983d6a59aab747423`.
- Wave 5 feature branch:
  `origin/codex/decompose-purchases` =
  `0133f9cf64417c9c1aa06f5b0159e3dd11ca9490`.
- A local integration branch pointer may be stale at `ac75c68`; do not use it as
  a base. Use remote verification.
- Immediately before creating this handoff branch, the only non-branch files in
  `git status` were the three preserved untracked design directories.

### GitHub

- PR [#6](https://github.com/darshan-Jahagirdar/bharat-growth/pull/6)
  (`codex/decompose-purchases` → integration) is merged.
- PR #6 head: `0133f9cf64417c9c1aa06f5b0159e3dd11ca9490`.
- PR #6 merge commit: `907dfe3b4f02bc872264c4b983d6a59aab747423`.
- PR #6 checks `quality`, `public-smoke`, Vercel, and Vercel Preview Comments
  completed successfully.
- Draft PR #1 is the integration-to-`main` release vehicle. It is not permission
  to merge or touch production.

### Supabase

- Production project ref: `vyycczqhvsgkiqtxxxos`.
- Linked staging project ref: `qokaaggeqahayxsybgds`.
- A fresh `supabase migration list --linked` returned continuous matching local
  and remote migrations 001–048.
- Staging uses synthetic/shared test data only. Production database/Auth was not
  queried or changed for Wave 5 or this handoff.
- The user-owned staging test Auth identity remains. The temporary tagged
  `public.users` mapping created for Wave 5 was deleted and verified absent.
- Legacy exposed staging credentials had already been disabled/revoked. Never
  print key material. Darshan intends to rotate remaining keys before the first
  sale; do not perform that future rotation during decomposition.

### Vercel

- Verified post-Wave-5 integration deployment:
  `dpl_5HprXDZjfavK1vGGYbtzZnGweWaB`.
- State: `READY`; target: Preview; region: Mumbai (`bom1`).
- Deployment Git metadata: branch `codex/production-hardening-baseline`, exact
  commit `907dfe3b4f02bc872264c4b983d6a59aab747423`.
- Runtime error-level log query for the latest 24 hours returned no entries.
- This is an integration preview, not production. No preview was promoted.

### Automated verification

- 94 tests pass across 19 files.
- Strict TypeScript passes.
- Repository-wide ESLint passes with zero warnings.
- Optimized Next.js build passes all 25 routes.
- GitHub `quality` and `public-smoke` pass for Wave 5.

### Collaboration artifacts

- Shared Google handoff:
  [BharatGrowth handoff](https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit).
- Slack channel: `#bharatgrowth`, ID `C0BG39UE1A9`.
- Verified Wave 5 merge post:
  [Slack message](https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784051619188539).
- Exact update/readback/send rules live in `COLLABORATION_WORKFLOW.md`.

## 7. Completed foundation and decomposition waves

### Production-hardening foundation

The integration baseline contains build/security/transactional fixes,
characterization tests, CI, staging-only Vercel isolation, and continuous
migrations 001–048. Migration 042 added constrained receipt/owner-phone RPCs but
intentionally retained legacy anonymous compatibility policies. The Receipt UI
uses its RPC; the browser Storefront loader still relies on compatible table
reads. Migration 049 must wait for public-consumer verification after the waves.
Production remains at the pre-hardening application commit.

### Wave 1 — Billing/POS

- Integration merge: `e6b58e3`.
- Characterization protected billing money, GST, payload, search, keyboard,
  barcode, customer, loyalty, khata, UPI, stock, online-order, print, and Sales
  Order behavior.
- Extraction order: pure logic, billing hooks/controllers, focused billing
  views.

### Wave 2 — Orders

- Integration merge: `1695da7`.
- Preserved Sales/Purchase Order loading, statuses, expansion, WhatsApp content,
  pagination, cancellation guards, and conversions.
- Query facade remained for Wave 7.

### Wave 3 — Products

- Integration merge: `b38e0ad`.
- Preserved product/edit payloads, money conversion, images, tags, stock,
  search, and bulk controls.

### Wave 4 — Dashboard/progress

- Branch was correctly based on integration `b38e0ad`.
- Characterization checkpoint: `74fc96b`; five initial Dashboard
  characterization tests passed and no Dashboard application source had changed
  at that checkpoint.
- Final integration merge: `ac75c68`.
- Final focused suite: ten Dashboard tests. Full repository at that wave: 83
  tests across 17 files.
- Dashboard route dropped from 973 to 117 lines; `dashboardQueries.ts` remained
  unchanged for Wave 7.
- Byte-identical 1440×900 visual comparison and staging browser/API cleanup are
  recorded in the decomposition log.

### Wave 5 — Purchases

- Branch base: integration `ac75c68`.
- Characterization checkpoint: `2e6bec8`.
- Pure transforms: `a6945f6`; controllers/hooks: `dc87b3a`; focused views:
  `97fbe54`; verification docs head: `0133f9c`.
- PR #6 merged only into integration at `907dfe3`.
- New Purchase route dropped from 871 to 78 lines. Six focused views, four
  hooks, and one 200-line transform module own the same behavior.
- Eleven Purchase tests cover shop/quota, search/focus, Enter/Tab/F10,
  validation, paise totals, exact bill/draft-PO payloads, scan validation and
  mapping. Full repository: 94 tests across 19 files.
- Purchase History and the order query facade had zero Wave 5 diff.
- Authenticated staging search/grid/clear smoke passed without invoking AI Scan,
  Save Bill, or Save as PO; no purchase/order/stock mutation was made.
- Same-fixture integration/Wave 5 JPEGs were byte-identical. Temporary previews,
  sessions, tagged profile, and local evidence were removed and verified.
- Production was untouched.

The complete commit, PR, preview, browser, visual, cleanup, and rollback evidence
is in `quality/DECOMPOSITION_LOG.md`.

## 8. Current stage and exact next work: Wave 6 Storefront

Wave 6 has not started. The documentation branch preparing this handoff contains
no application-source change. Start Wave 6 only after this docs PR is merged
into integration and the live state below is re-derived.

### Wave 6 branch and base

- Create `codex/decompose-storefront` from the freshly verified remote
  `codex/production-hardening-baseline` head.
- Confirm the application tree beneath any docs-only merge still matches
  application checkpoint `907dfe3`.
- Confirm production `main` is still `8c38909`.
- Recheck PR #1/#6 state, staging project/migrations, and latest exact-commit
  integration Vercel preview before any source edit.

### Characterization checkpoint before extraction

Add focused tests against unchanged Storefront behavior and commit them before
editing Storefront application source. At minimum freeze:

- loader states, selected shop/product/owner-field mapping through the current
  compatibility policies, tracked/untracked/missing
  inventory semantics, document title, and modern/industrial/festive dispatch;
- category collection/sorting, name/category search, deterministic placeholder,
  price/unit output, and empty state;
- cart add/increment/decrement/removal, count/total, zero stock, stock clamp,
  toast, and plus-button states;
- checkout drawer/scroll lock, required fields, consent distinction, payment
  modes, exact payload/item order, idempotency-key reuse/retirement, loading and
  errors;
- network/non-2xx hard stop with no WhatsApp navigation;
- success clearing and same-tab WhatsApp URL/message using server-confirmed
  order number/total;
- Industrial/Festive grouping and their per-product WhatsApp-only behavior;
- exact copy and visual/DOM-visible output needed for comparison.

Record the pre-extraction Storefront source diff as zero and the characterization
commit as the rollback boundary.

### Extraction order

1. **Pure transforms:** characterization-backed category/filter/price,
   placeholder, cart math/updates, and WhatsApp/payload builders. Do not move
   provider or data effects into “pure” code.
2. **Controllers/hooks:** cart and checkout state/effects, idempotency lifecycle,
   loader orchestration only where query shapes stay byte-for-byte compatible.
   Do not change `src/lib/storefront/queries.ts` as a query-facade refactor; that
   belongs to Wave 7.
3. **Focused views:** Modern header/category/search, catalog cards, cart bar, and
   checkout drawer. Extract shared theme sections only when the existing output
   for all three themes is unchanged. Industrial and Festive are already
   focused; do not mechanically unify them or give them Modern cart behavior.

### Wave 6 prohibited changes

No feature, schema, migration, query-facade, copy, style, layout, animation,
theme, cart, stock, checkout, consent, payload, public boundary, focus, keyboard,
WhatsApp message, navigation, error-ordering, or workflow change. Do not fix
auth formatting, payment gateway, provider configuration, rate limiting,
monitoring, or sale-readiness backlog inside this wave.

### Wave 6 closeout gates

- Focused characterization and full 94+ tests pass.
- Strict typecheck, zero-warning lint, optimized 25-route build, and
  `git diff --check` pass.
- Draft PR targets only integration and has exact green GitHub checks.
- Branch-scoped preview proves staging Supabase and excludes production.
- Public smoke covers UUID validation, loader/error states, all three themes,
  search/categories, strict stock, cart, checkout validation, and a bounded
  non-destructive path. Do not place an order unless Darshan separately approves
  the exact synthetic staging mutation.
- Same fixture, viewport, state, browser, and route are used for integration and
  Wave 6 visual captures. Copy/DOM and pixel output must match.
- Runtime errors are inspected.
- Temporary preview variables, workaround previews, sessions, fixtures, and
  evidence artifacts are removed and cleanup is verified.
- Repository docs, Google handoff, and `#bharatgrowth` reflect exact results.
- Merge only into integration, then verify remote head and post-merge preview.

## 9. Wave 7 and pre-launch work

After Wave 6 is fully merged and staging-smoked, Wave 7 decomposes data-access
modules by use case behind compatibility exports. It must not change SQL,
filters, selections, ordering, RPC arguments, error mapping, tenant rules, or
call sequencing.

After all seven waves, remaining work is not “just deploy”:

- write/review migration 049 contract cleanup and verify it on staging;
- complete the full sale-readiness regression matrix;
- finish external Meta, monitoring, rate-limit, and other approved blockers;
- verify production identity cleanup and exact production target at the explicit
  production gate;
- perform the single controlled staged-then-production rollout described by the
  approved brief, with a new explicit Darshan approval. There are currently no
  real users, but production remains out of scope until that gate.

Planned product work such as payments/subscriptions, loyalty redemption,
offline/bilingual/e-invoicing, discount design, and auth redesign remains
separate. See the feature inventory and quality checklist.

## 10. Known stop conditions

Stop before source or external writes if any of the following is true:

- a required file was not read completely;
- remote integration/main, PR state, staging project/migrations, or deployment
  commit/state contradicts this handoff;
- the application tree differs from the expected integration application
  checkpoint for unexplained reasons;
- the working tree contains anything besides intended branch changes and the
  three preserved design directories;
- preview isolation cannot prove staging-only use;
- the user-owned test Auth identity or any temporary row cannot be safely
  distinguished;
- a Wave 6 change would alter behavior or needs a schema/query-facade/provider
  change;
- a credential, OTP, private fixture, or production action would have to be
  exposed or guessed;
- any gate fails or cleanup cannot be proven.

## 11. Exact first prompt for the next Codex task

Use this continuation prompt after opening a fresh task:

> Continue BharatGrowth from the verified handoff. First read
> `/Users/darshan_j/BharatGrowth/docs/bharatgrowth/CODEX_HANDOFF.md` completely,
> then every file in its Required reading order. Do not trust remembered state.
> Re-derive local/remote Git, GitHub PR/checks, linked staging Supabase/migrations,
> and exact-commit integration Vercel state; stop on contradiction. Preserve and
> exclude `designs/`, `designs_mobile/`, and `docs/bharatgrowth/design/`; never
> print or invent secrets. Confirm Waves 1–5 are merged only into integration,
> production remains `8c38909`, and the application tree beneath the handoff-doc
> update matches Wave 5 application checkpoint `907dfe3`. Then start Wave 6
> Storefront exactly under `DECOMPOSITION_PLAN.md`: characterization checkpoint
> before application changes, pure transforms first, controllers/hooks second,
> focused views last. Preserve every feature and behavior in
> `FEATURE_AND_BEHAVIOR_INVENTORY.md`; no feature, schema, query-facade, copy,
> styling, payload, visual, focus, keyboard, RLS, stock, consent, WhatsApp,
> provider, or workflow change. Complete automated, branch-scoped staging
> preview, browser, visual, cleanup, repository-doc, Google handoff, Slack, and
> PR gates before merging only into `codex/production-hardening-baseline`. Do not
> touch production.
