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
revertible waves. Waves 1–6 are merged into the integration branch. Wave 7 is
the final decomposition wave and covers data-access/query facades.

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

Wave 7 is the explicit exception to steps 3–5: after characterization, it
splits data-access implementation by cohesive use case and leaves the original
facades as compatibility exports. Its exact order is in Section 8 and
`quality/DECOMPOSITION_PLAN.md`.

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
  removed. Do not commit it. Current UI visibly shows `+91`; committed
  `useAuth.sendOtp` sends `91XXXXXXXXXX` without a literal plus. Preserve that
  exact inherited behavior until the separately approved auth/provider work.
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

## 6. Exact verified checkpoint before this Wave 7 handoff-doc PR

The docs-only handoff PR is expected to advance the integration branch without
changing application source. Therefore the next task must re-derive the current
integration SHA. The exact application-source checkpoint beneath this docs-only
change is `145437b13eeff1d1cd4f7eebfe86d06611805dfb`.

### Git

- Repository: `darshan-Jahagirdar/bharat-growth`.
- Production `origin/main`:
  `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
- Verified integration before this docs-only handoff:
  `origin/codex/production-hardening-baseline` =
  `6255234937a79b2d74d2a3a577a8065d167d911f`.
- Wave 6 feature branch:
  `origin/codex/decompose-storefront` =
  `d02a592d500bb63041131792ad43554eac806c71`.
- `6255234` has parents `d9d7b4f` and `d02a592`; its application tree matches
  reviewed Wave 6 application checkpoint `145437b` with no post-review source
  drift.
- The local integration branch pointer is stale at `ac75c68`; do not use it as a
  base. Use fresh remote verification.
- Before creating `codex/prepare-wave7-handoff`, the only non-branch files were
  preserved untracked `designs/`, `designs_mobile/`,
  `docs/bharatgrowth/design/`, and the concurrent user-approved
  `docs/bharatgrowth/CLAUDE_HANDOFF.md`. Keep all four unstaged and excluded.

### GitHub

- PR [#8](https://github.com/darshan-Jahagirdar/bharat-growth/pull/8)
  (`codex/decompose-storefront` → integration) is merged.
- PR #8 head: `d02a592d500bb63041131792ad43554eac806c71`.
- PR #8 merge commit: `6255234937a79b2d74d2a3a577a8065d167d911f`.
- PR #8 checks `quality`, `public-smoke`, Vercel, and Vercel Preview Comments
  completed successfully.
- Draft PR #1 remains the guarded integration-to-`main` release vehicle. It is
  open, draft, clean, and points from integration head `6255234` to `main`; it is
  not permission to merge or touch production.

### Supabase

- Production project ref: `vyycczqhvsgkiqtxxxos`.
- Linked staging project ref: `qokaaggeqahayxsybgds`.
- A fresh `supabase migration list --linked` returned continuous matching local
  and remote migrations 001–048.
- Staging uses synthetic/shared test data only. The two temporary theme changes
  used for Wave 6 were restored; readback confirmed all three seed shops are
  `modern`.
- The user-owned staging test Auth identity remains. Wave 6 created no Auth or
  profile fixture and performed no checkout/data mutation.
- Legacy exposed staging credentials had already been disabled/revoked. Never
  print key material. Darshan intends to rotate remaining keys before the first
  sale; do not perform that future rotation during decomposition.

### Vercel

- Verified post-Wave-6 integration deployment:
  `dpl_3cu9JfBqjAgB929LQbmvAC2bEmmh`.
- State: `READY`; target: Preview; region: Mumbai (`bom1`).
- Deployment Git metadata: branch `codex/production-hardening-baseline`, exact
  commit `6255234937a79b2d74d2a3a577a8065d167d911f`.
- All eight login-page chunks loaded. The combined bundle contains exact staging
  ref `qokaaggeqahayxsybgds` and the active publishable-key shape, with no
  unexpected Supabase ref, legacy JWT key shape, or preview-overlay marker.
- Runtime error/warning/fatal query returned no entries.
- All three temporary variables scoped to `codex/decompose-storefront` were
  removed after post-merge verification; branch readback returned `envs: []`.
- This is an integration preview, not production. No preview was promoted, and
  obsolete retained deployments were not deleted.

### Automated verification

- 116 tests pass across 24 files at application checkpoint `145437b`.
- Strict TypeScript passes.
- Repository-wide ESLint passes with zero warnings.
- Optimized Next.js build passes all 25 routes.
- GitHub `quality` and `public-smoke` pass at exact Wave 6 head and the merged
  integration head.
- The application suite was not repeated after docs-only or merge commits because
  application/configuration did not change.

### Collaboration artifacts

- Shared Google handoff:
  [BharatGrowth handoff](https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit).
- Slack channel: `#bharatgrowth`, ID `C0BG39UE1A9`.
- Verified Wave 6 merge post:
  [Slack message](https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784124233674089).
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

### Wave 6 — Storefront

- Branch base: integration `d9d7b4f`; characterization checkpoint `ac7fe57`.
- Pure transforms: `cedec19`; controllers/hooks: `675d106`; focused views:
  `145437b`; verification docs head: `d02a592`.
- PR #8 merged only into integration at `6255234`.
- `ModernTheme.tsx` dropped from 717 to 77 lines and now composes focused
  header, catalog, cart, and checkout views. Industrial/Festive, the loader,
  checkout route, query facade, Auth, schema, migrations, RLS, and payload
  boundaries had zero Wave 6 diff.
- Sixteen pre-extraction tests plus direct transform coverage freeze loader,
  themes, catalog/search, strict stock, cart, checkout, consent, payload,
  idempotency, hard-stop, and WhatsApp behavior. Full repository: 116 tests
  across 24 files.
- Public Modern, Industrial, and Festive mobile smoke passed. Both temporary
  theme changes were restored and all three seed shops read back as `modern`.
- Darshan explicitly waived the integration-versus-Wave 6 pixel comparison
  because an intentional Storefront reskin is next. This is a waiver, not a
  pixel-equivalence result.
- Exact merged integration preview is READY and staging-only with empty queried
  runtime errors. Temporary Wave 6 branch variables were removed and verified
  absent. Production was untouched.

The complete commit, PR, preview, browser, visual, cleanup, and rollback evidence
is in `quality/DECOMPOSITION_LOG.md`.

## 8. Current stage and exact next work: Wave 7 data access

Wave 6 is merged and staging-smoked. The documentation branch preparing this
handoff contains no application-source change. Start Wave 7 only after this docs
PR is merged into integration and the live state below is re-derived.

### Wave 7 branch and base

- Create `codex/decompose-data-access` from the freshly verified remote
  `codex/production-hardening-baseline` head.
- Confirm `src/` and `supabase/` beneath the docs-only merge still match exact
  Wave 6 application checkpoint `145437b`.
- Confirm production `main` is still `8c38909`.
- Recheck PR #1/#8 state, staging project/migrations, and latest exact-commit
  integration Vercel preview before any source edit.

### In-scope compatibility facades

- `src/lib/billing/billingQueries.ts` — 408 lines;
- `src/lib/orders/orderQueries.ts` — 431 lines;
- `src/lib/dashboard/dashboardQueries.ts` — 672 lines;
- `src/lib/storefront/queries.ts` — 129 lines.

The original four module paths and every current exported function, interface,
type, constant, parameter default, and return contract remain compatibility
boundaries. Existing callers should not need behavioral changes.

### Characterization checkpoint before implementation movement

Add focused tests against the unchanged facades and commit them before moving
implementation. At minimum freeze:

- authenticated browser client versus server public client creation and reuse;
- exact table/RPC/storage names, selected columns/joins, filter and call order,
  pagination/ranges/limits, sorting/null behavior, payload construction, and
  optional-argument omission;
- Billing search sanitization, lazy loyalty, barcode, invoice/repayment RPCs,
  refresh, customer image/create/consent flow, and shop context;
- Orders header-then-item loading/grouping, 50-row `hasMore`, create/convert
  RPCs, guarded cancellation, error/fallback output, and logs;
- Dashboard IST ranges, parallel orchestration, KPI/aggregation/rounding,
  retention mapping, khata/stock reads, and GST row order/output;
- Storefront public shop plus owner-phone RPC behavior, active catalog ordering,
  tracked/untracked/missing inventory mapping, and non-fatal owner/product
  failures;
- exact thrown-versus-returned errors, empty/null defaults, warning/error side
  effects, result shaping, tenant scoping, and call sequencing.

Record the four in-scope facade files as unchanged at the checkpoint. The
characterization commit is the Wave 7 rollback boundary.

### Implementation order

1. **Shared types where cohesive:** move types only when their original exports
   and module identity remain compatible.
2. **Billing and Orders use cases:** split reads/writes/RPCs without changing
   any query, mutation, error path, or caller behavior.
3. **Dashboard and Storefront use cases:** split analytics, retention, stock,
   GST, public shop/contact, and catalog access under the same trust boundaries.
4. **Compatibility facades last:** leave the original four modules as explicit
   re-export facades and prove every current caller resolves the same symbols.

### Wave 7 prohibited changes

No feature, schema, migration, SQL, RLS, policy, grant, function, API, payload,
copy, style, DOM, visual, focus, keyboard, stock, consent, Auth, provider,
Storefront public-boundary hardening, route, error-ordering, call-ordering, or
workflow change. Do not start migration 049, the intentional reskin, auth/
payment work, rate limiting, monitoring, or sale-readiness fixes inside Wave 7.

### Wave 7 closeout gates

- Focused pre-movement characterization and the complete final suite pass.
- Strict typecheck, zero-warning lint, optimized 25-route build,
  `git diff --check`, compatibility-export checks, and credential scans pass.
- `supabase/`, route/component/hook UI source, API boundaries, and existing
  caller imports have no unintended diff.
- Draft PR targets only integration and has exact green GitHub checks.
- Branch-scoped preview proves staging Supabase and excludes production.
- Public Storefront plus bounded protected Billing, Orders, and Dashboard reads
  prove representative real staging data flows that mocks cannot prove. Do not
  invoke write RPCs, provider actions, Auth/OTP, or create fixtures unless a
  separate exact need and approval appears.
- When no TSX/CSS/DOM source changes, do not manufacture a duplicate pixel
  comparison. Record zero UI-source diff and exact rendered data-flow/console
  evidence; browser checks remain limited to otherwise-unprovable behavior.
- Runtime errors are inspected.
- Temporary preview variables, sessions, fixtures, and evidence artifacts are
  removed and cleanup is verified.
- Repository docs, Google handoff, and `#bharatgrowth` reflect exact results.
- Merge only into integration, then verify remote head and post-merge preview.

## 9. Post-Wave 7 and pre-launch work

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
- the working tree contains anything besides intended branch changes, the
  three preserved design directories, and the known concurrent untracked
  `docs/bharatgrowth/CLAUDE_HANDOFF.md`;
- preview isolation cannot prove staging-only use;
- the user-owned test Auth identity or any temporary row cannot be safely
  distinguished;
- a Wave 7 change would alter query/RPC/client behavior or needs a schema,
  migration, RLS, provider, Auth, UI, or workflow change;
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
> print or invent secrets. Confirm Waves 1–6 are merged only into integration,
> production remains `8c38909`, and `src/` plus `supabase/` beneath the handoff-
> doc update match Wave 6 application checkpoint `145437b`. Then start Wave 7
> data access exactly under `DECOMPOSITION_PLAN.md`: characterize the unchanged
> Billing, Orders, Dashboard, and Storefront query facades before moving any
> implementation; split by cohesive use case behind compatibility exports; keep
> original module paths and callers stable. Preserve every feature and behavior
> in `FEATURE_AND_BEHAVIOR_INVENTORY.md`; do not change SQL selections, filters,
> ordering, pagination, RPC arguments, result/error mapping, tenant/client trust
> boundaries, call sequencing, schema, migrations, RLS, API/payloads, UI/copy,
> Auth, providers, or workflows. Complete automated, branch-scoped staging
> preview, representative data-flow browser, runtime, cleanup, repository-doc,
> Google handoff, Slack, and PR gates before merging only into
> `codex/production-hardening-baseline`. Do not start migration 049, the reskin,
> or production work.
