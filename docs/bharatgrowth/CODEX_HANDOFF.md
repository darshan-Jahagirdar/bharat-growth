# BharatGrowth Codex Handoff

Last verified: 2026-07-13 (Asia/Kolkata)

This is the first file the next Codex thread must read. It is a continuation
handoff, not a new planning proposal. Re-verify every drift-prone statement
before acting; if disk, GitHub, Supabase, or Vercel disagrees with this document,
stop and report the mismatch.

## 1. Why this work started

Darshan asked for an expert production-readiness review because BharatGrowth is
important to him and the large, mixed-responsibility files felt unsafe and
messy. The goal is not to redesign the product. The goal is to make the codebase
understandable, testable, and production-level while preserving every approved
behavior.

Claude/Fable first produced `BUG_FIX_PLAN.md` and `FIX_CHECKLIST.md`. Codex was
then asked to verify the findings against the real code, fix the production
hardening baseline, preserve the current production state as a fallback, prove
Supabase migrations on an isolated staging project, and decompose the largest
domains through small reversible PRs.

Darshan's central safety requirement is literal: cautious behavior preservation
matters more than speed. A feature must not be relabeled as a bug, and a
decomposition PR must not contain a feature change, visual change, schema
change, or opportunistic fix.

## 2. Locked decisions

- Production `main` is not an editing branch and must not receive a direct push.
- Immutable pre-hardening fallback tag: `pre-hardening-8c38909` at `8c38909`.
- Integration/staging branch: `codex/production-hardening-baseline`.
- Each domain uses one short-lived `codex/decompose-*` branch and one
  independently revertible PR into the integration branch, never directly into
  `main`.
- Every wave requires characterization before extraction, automated checks,
  staging-only preview isolation, authenticated targeted smoke, visual
  comparison, evidence logging, and green CI before merge.
- Decomposition preserves routes, copy, styling, payloads, calculations,
  keyboard/focus/modal behavior, RLS assumptions, stock rules, and user flows.
- Database query-module splitting belongs to Wave 7. Earlier waves may consume
  the current data-access facade but must not quietly decompose it.
- Production remains unchanged until all seven decomposition waves and every
  approved launch feature pass staging.
- Darshan will perform/approve full manual hard testing before the app is sold.
- Darshan's explicit direction is that all features intended for the sale-ready
  rollout are decided before production rollout. Do not assume an item is safe
  to defer merely because an older roadmap placed it later; confirm launch scope
  before production planning.
- There are no real users yet; current production data is test data. This
  changes urgency and permits controlled reseeding, but it does not relax
  staging-first, RLS, migration, verification, or rollback gates.
- The final evidence-backed code-quality scorecard is produced only after the
  decomposition, launch gates, and manual regression evidence are complete.

## 3. Required reading order in a fresh thread

Read these completely before repository changes:

1. `docs/bharatgrowth/CODEX_HANDOFF.md` (this file)
2. `docs/bharatgrowth/CODEX_BRIEF.md`
3. `docs/bharatgrowth/README.md`
4. `docs/bharatgrowth/quality/DECOMPOSITION_PLAN.md`
5. `docs/bharatgrowth/quality/DECOMPOSITION_LOG.md`
6. `docs/bharatgrowth/quality/BEHAVIOR_CONTRACTS.md`
7. `docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`
8. `docs/bharatgrowth/quality/BUG_FIX_PLAN.md`
9. `docs/bharatgrowth/quality/FIX_CHECKLIST.md`
10. `docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`

Then re-derive state with `git status`, `git log`, current/local/remote branch
pointers, `supabase migration list`, GitHub PR/check state, and the relevant
Vercel deployment. Do not trust a compacted conversation summary over disk or
live state.

## 4. Exact verified checkpoint

### Git

- Repository: `darshan-Jahagirdar/bharat-growth`.
- Remote production `main`: `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
- Remote integration: `b38e0ad4fb16ec613fa23293cf1be21c3ea853f9`.
- Current local branch: `codex/decompose-dashboard-progress`.
- Wave 4 pre-extraction characterization commit: `74fc96b`.
- The Wave 4 branch has not been pushed and has no PR at this handoff.
- Preserve and exclude the user-owned untracked directories:
  `designs/`, `designs_mobile/`, and `docs/bharatgrowth/design/`.

### GitHub

- Draft PR #1 is open from `codex/production-hardening-baseline` to `main`:
  <https://github.com/darshan-Jahagirdar/bharat-growth/pull/1>.
- Its current head is `b38e0ad`; `quality`, `public-smoke`, Vercel, and Vercel
  Preview Comments pass.
- PR #2 Billing/POS merged into integration as `e6b58e3`.
- PR #3 Orders merged into integration as `1695da7`.
- PR #4 Products merged into integration as `b38e0ad`.
- No decomposition wave has merged to production `main`.

### Supabase

- Production ref: `vyycczqhvsgkiqtxxxos` (do not link or mutate during waves).
- Linked staging ref: `qokaaggeqahayxsybgds` (`BharatGrowth Staging`).
- A fresh CLI check on 2026-07-13 returned continuous matching local/remote
  migrations `001` through `048`.
- Migration 049 does not exist yet and must not be created during Wave 4.
- No disposable staging auth user remains from Waves 1–3.
- Production database, migration ledger, auth users, and data were not changed
  during decomposition.

### Vercel

- Latest verified integration preview: deployment
  `dpl_A4T2yF65jaGqpwcMNjnBA3LDFRF5`, READY for `b38e0ad`.
- Its public chunks were verified to contain the staging ref and no production
  ref or framework-overlay marker.
- Critical recurring risk: a new short wave branch initially inherits the
  global Preview production Supabase variables unless branch-specific staging
  overrides are configured. Never authenticate to a preview until its public
  assets prove staging ref present and production ref absent.
- `codex/decompose-dashboard-progress` does not yet have its Wave 4 Preview
  branch overrides or Supabase redirect URL configured.
- A staging-only preview secret named `codex_decomposition_previews` is stored
  in macOS Keychain for the decomposition workflow. Never print it, copy it to
  documentation, or expose it to the client. Revoke it after all waves.

### Local verification at the handoff

- Five Dashboard characterization tests pass against the unchanged page.
- Full repository: 78 tests pass across 16 files.
- `npm run typecheck` passes.
- Repository-wide `npm run lint` passes with zero warnings.
- `git diff --check` and the targeted credential-pattern scan pass.
- The latest merged integration build (Wave 3) passed the optimized 25-route
  Next.js build. The Wave 4 checkpoint changes only tests/docs, so no new build
  claim is made yet.

### Collaboration artifacts

- Google handoff:
  <https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit>
- Wave 3 Slack evidence:
  <https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1783958639558509>
- Slack channel: `#bharatgrowth`, ID `C0BG39UE1A9`.
- GitHub, Supabase, Google Drive, Slack, and Vercel authentication worked in the
  prior thread. Darshan is available to re-authenticate if a service explicitly
  requires it; do not ask preemptively when a read-only verification succeeds.

## 5. What is already implemented and proven

### Production-hardening baseline

- Preserved production `main` and created the fallback tag.
- Created the reviewed workspace checkpoint and canonical engineering docs.
- Added required GitHub CI for typecheck, lint, tests, build, and public smoke.
- Removed tracked machine-local state and neutralized the committed development
  auth migration.
- Added GSTIN checksum validation and updated the Anthropic vision model.
- Hardened WhatsApp failure handling, receipt/storefront public access,
  repayment atomicity, SO fractional/composition handling, loyalty races,
  invoice IST dates, demo save, search escaping, UPI/modal behavior, AI quota,
  file validation, and loyalty balance locking as documented in the bug plan.
- Reproduced migrations `001–048` from empty staging, fixed fresh-install
  ordering and loyalty-ordering defects, loaded synthetic data, and verified
  schema lint/RLS/public RPC boundaries without changing production.
- Disabled/revoked the staging legacy key path after modern publishable/secret
  access was proven.

### Wave 1 — Billing/POS

- PR #2 merged into integration at `e6b58e3`.
- Route reduced from 1,412 to 739 lines; focused views, payload builders, search
  hooks, and keyboard-related contracts were separated.
- 34 focused tests and 51 repository tests passed at the wave gate.
- Staging billing/SO/cash flows and exact visual parity passed.
- Known broader payment/credit/printing/tracked-stock cases remain in the final
  manual hard-test scope, not silently claimed complete.

### Wave 2 — Orders

- PR #3 merged into integration at `1695da7`.
- Route reduced from 1,127 to 82 lines; a controller hook and focused sales,
  purchase, status, expansion, dialog, and presentation modules were extracted.
- The 431-line Orders query module was deliberately left for Wave 7.
- 9 focused tests and 60 repository tests passed at the wave gate.
- Visual parity, real staging data, lazy tabs, actions, WhatsApp links, PO/SO
  conversion, stock movements, and cleanup passed.

### Wave 3 — Products

- PR #4 merged into integration at `b38e0ad`.
- Route reduced from 1,004 to 104 lines; six focused views, pure form/money/search
  helpers, a data hook, and an editor hook were extracted.
- 13 focused tests and 73 repository tests passed at the wave gate.
- The final visual comparison was byte-identical: 0 of 1,296,000 pixels changed.
- Staging add/edit paise payloads, tags, image validation, search, bulk modal,
  tracked stock adjustment, and synthetic cleanup passed.

## 6. Current work: Wave 4 Dashboard/progress

### What has happened

- The branch was created from verified integration `b38e0ad`.
- `src/app/dashboard/page.tsx` is still exactly the integration version and is
  973 lines.
- No Dashboard application source has been edited.
- `src/lib/dashboard/dashboardQueries.ts` remains unchanged at 672 lines and is
  reserved for Wave 7.
- Characterization commit `74fc96b` adds five tests plus the corresponding
  decomposition-log checkpoint.

### Current responsibilities that must be separated without changing behavior

- Auth session and onboarded-shop resolution.
- Separate shop business-name loading.
- IST `today`, seven-day, month, and custom date-range construction.
- Dashboard data loading and selected-period state.
- Current-month GST export, filename sanitization, alerts, and success state.
- Retention/progress hero, KPI cards, revenue chart, top-products donut.
- Khata hitlist, reminder confirmation/API payload, and success toast.
- Negative-stock anomaly list, reconciliation RPC, and refresh.
- Low-stock action list, modal state, overlay behavior, and scrollbar styling.

### Characterization contracts now frozen

- Auth resolves user `user-1` to shop `shop-1`; the shop name is read separately
  from `shops.business_name`.
- Default 2026-07-13 IST range is
  `2026-07-01T00:00:00+05:30` through
  `2026-07-13T23:59:59+05:30`.
- Today and custom date controls preserve exact timestamp boundaries.
- Progress/KPI values and `/store/{shopId}` link render unchanged.
- GST export calls `exportGstReport(shopId)` and uses the existing
  `GST_Report_<safe shop>_<Mon><Year>.csv` filename.
- Khata reminder POSTs only `{ customer_id }` to the existing endpoint.
- Reconciliation calls `adjust_stock` with the current purchase/manual payload,
  allows negative correction, and then refreshes with
  `fetchAllDashboardData(shopId)` without the selected range. That refresh quirk
  is current behavior and must not be "fixed" inside decomposition.

### Recommended extraction map

Keep files cohesive and normally under 250 lines; keep the route under 300 lines.
Names may be adjusted if a clearer boundary emerges, but ownership must remain
equivalent.

1. Pure transforms/constants first:
   - `DatePreset`, IST date-range construction, period label.
   - top-product total and GST export filename construction.
2. Controller hooks second:
   - dashboard auth/shop/data orchestration.
   - GST export state/action.
   - khata reminder state/action.
   - stock reconciliation state/action.
3. Focused named views last:
   - header/export/storefront and date filter.
   - KPI/progress metric sections.
   - revenue and top-product charts.
   - anomaly, khata, and low-stock action sections.
   - reminder and reconciliation dialogs plus success toast.
4. Keep the existing `RetentionRoiCard` behavior and current
   `dashboardQueries.ts` facade unchanged.

### Next Wave 4 execution gates

1. Re-run the five characterization tests before source extraction.
2. Add direct pure-transform tests before moving the transform logic.
3. Extract in small reviewable steps and compare payload/copy/style line by line.
4. Run focused tests, full tests, typecheck, zero-warning lint, optimized build,
   `git diff --check`, and targeted secret scan.
5. Push only reviewed commits; open a draft PR targeting
   `codex/production-hardening-baseline`.
6. Configure only the Wave 4 branch's staging Preview values. Verify public
   chunks before any login.
7. Add the exact Wave 4 preview redirect to staging Auth only when required.
8. Use a disposable staging user linked to synthetic data; never production.
9. Smoke date filters, metric/progress values, charts/empty states, GST export,
   storefront link, reminder modal/API, anomaly reconciliation, low stock,
   overlay/focus behavior, and browser errors.
10. Compare integration and Wave 4 screenshots at the same authenticated state,
    data, viewport, fonts, and toolbar state. Any pixel difference must be
    explained or treated as a failure.
11. Delete synthetic mutations and the disposable user; remove cookies,
    screenshots, env pulls, helpers, and temporary credentials.
12. Record commit/PR/preview/checks/manual/visual/cleanup evidence in the log and
    PR, merge only after every gate passes, then update Google handoff and post a
    verified `#bharatgrowth` milestone.

## 7. Remaining roadmap after Wave 4

1. Wave 5 Purchases — controller/state, editable grid, keyboard behavior, AI
   scan mapping, totals, draft and save actions.
2. Wave 6 Storefront — catalog/filter, cart, checkout controller/dialogs, and
   theme sections with pixel-stable output.
3. Wave 7 Data access — split query modules by use case behind compatibility
   exports.
4. Decide and staging-verify every feature included in the sale-ready rollout.
   The known decision queue includes discount UI/rules, Razorpay, and the later
   frontend overhaul; do not decide their rollout placement without Darshan.
5. Write/review migration 049 only after all waves, apply it to staging, and
   verify the anonymous boundary and complete database cases.
6. Resolve the production rollout-document conflict described below before any
   production database/deployment action.
7. Run the full manual regression checklist before selling.
8. At the controlled pre-launch production gate: verify the exact target,
   delete `dev@bharatgrowth.in` from production `auth.users` and the matching
   `public.users` row, apply the approved migration/deployment sequence,
   smoke-test production, confirm monitoring/migration history, retain the
   last-known-good Vercel deployment, create a release tag, and produce the final
   code-quality scorecard.
9. Post final success to `#bharatgrowth` only if every required deployment,
   migration, smoke, cleanup, and rollback gate passes.

## 8. Known open items and stop conditions

### Documentation conflict to resolve before production

`CODEX_BRIEF.md` is the latest user-approved process brief and calls for a
single staged-then-production pre-launch rollout because there are no real
users. `README.md`, `MIGRATION_RUNBOOK.md`, and
`operations/DEPLOYMENT_AND_ROLLBACK.md` still contain parts of the older
expand/application/contract choreography and a rule against combining the
application dependency with the contract change. The brief itself says not to
choose a route when documents conflict. This does not block Waves 4–7, but it is
a hard stop before production planning: surface it to Darshan/Claude and
reconcile the canonical documents first.

Other current open gates:

- `README.md` still labels the pre-decomposition baseline reference as pending;
  that table is stale and must not override the verified Git state.
- Migration 049 and its forward recovery migration are not written.
- Production RLS/public-boundary changes are not applied.
- Production development-user deletion is not performed.
- CRON secret rotation, Meta webhook/templates, rate limiting, and production
  monitoring remain external launch gates.
- Full cash/UPI/card/credit, printing, khata/repayment, tax, tenancy, storefront,
  campaign, and complete manual regression are not yet signed off for sale.
- The staging-only decomposition preview secret must be revoked after the waves.

Stop immediately on any of these conditions:

- wrong Git branch/base or unexpected production pointer change;
- migration drift, duplicate versions, destructive/unreviewed SQL, or wrong
  Supabase project ref;
- preview contains the production ref, lacks the staging ref, or shows a
  framework/runtime error;
- behavior, payload, copy, focus, keyboard, visual, tenant, or stock mismatch;
- failed test, typecheck, lint, build, CI, smoke, cleanup, or visual gate;
- missing private configuration that would require inventing or printing a
  secret;
- user-owned design directories appear in a proposed stage/commit;
- a document or live service contradicts this handoff.

## 9. First prompt for the next Codex thread

Copy and send this as the first message in the new thread:

> Continue the BharatGrowth safe decomposition from the verified handoff.
> First, read `/Users/darshan_j/BharatGrowth/docs/bharatgrowth/CODEX_HANDOFF.md`
> completely, then read every file in its "Required reading order." Do not trust
> remembered or compacted state. Re-derive local Git status/log/branch, remote
> `main` and integration pointers, GitHub PR/check state, linked Supabase project
> and `supabase migration list`, and the latest integration Vercel result. Stop
> and report if anything contradicts the handoff. Preserve and exclude
> `designs/`, `designs_mobile/`, and `docs/bharatgrowth/design/`; never print or
> invent secrets. Confirm Wave 4 is on
> `codex/decompose-dashboard-progress`, based on integration `b38e0ad`, with
> characterization checkpoint `74fc96b`, five Dashboard tests passing, and no
> Dashboard application-source changes. Then continue Wave 4 Dashboard/progress
> exactly under `DECOMPOSITION_PLAN.md`: pure transforms first, controllers/hooks
> second, focused views last; no feature, schema, query-facade, copy, styling,
> payload, visual, focus, keyboard, RLS, stock, or workflow changes. Complete all
> automated, branch-scoped staging preview, browser smoke, visual, cleanup,
> documentation, PR, Google handoff, and `#bharatgrowth` gates before merging
> only into `codex/production-hardening-baseline`. Do not touch production.
