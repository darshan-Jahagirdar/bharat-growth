# BharatGrowth Codex Handoff

Last updated: 2026-07-19 (IST)
Owner: Darshan
Maintainer signature: Sol/Codex

This is the canonical operating handoff for BharatGrowth. It records the exact
post-migration-049, post-Auth-normalization, post-sale-readiness checkpoint. It
does not authorize production access, a production rollout, or fixes for the
recorded sale-readiness failures.

## 1. Product and branch model

BharatGrowth is a Next.js/Supabase/Vercel small-business ERP covering POS
billing, GST, customer loyalty and khata, inventory, purchase and sales orders,
campaigns, analytics, a public storefront, online checkout, and public receipts.

- Production Git branch: `main`
- Production Git checkpoint: `8c389098db7e31180b5bdd6f1661adfd4bdc902b`
- Immutable fallback tag: `pre-hardening-8c38909`
- Integration/staging branch: `codex/production-hardening-baseline`
- Current verified integration commit: `7add48b05a9f282948566e583bfed65ff7595eb4`
- New work branches from a freshly verified remote integration SHA and PRs only
  back to integration unless Darshan separately authorizes production.

Production remained untouched throughout migrations 049, Auth normalization,
and the sale-readiness matrix. No production Supabase or Vercel endpoint was
accessed.

## 2. Required reading order

Read these completely before continuing work:

1. `docs/bharatgrowth/CODEX_HANDOFF.md`
2. `docs/bharatgrowth/COLLABORATION_WORKFLOW.md`
3. `docs/bharatgrowth/quality/BEHAVIOR_CONTRACTS.md`
4. `docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md`
5. `docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`
6. `docs/bharatgrowth/database/MIGRATION_049_PLAN.md`
7. `docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`
8. `docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`

Do not open, edit, stage, or infer from excluded user-owned paths:
`designs/`, `designs_mobile/`, `docs/bharatgrowth/design/`, and
`docs/bharatgrowth/CLAUDE_HANDOFF.md`.

## 3. Exact current checkpoint

### Git and GitHub

- PR #12, storefront loader → owner-phone RPC, merged at `3cca263`.
- PR #13, migration 049, merged into integration.
- Post-049 integration checkpoint before Auth work: `e5147d1`.
- PR #14, canonical E.164 India phone normalization, merged into integration as
  `d74ca83` (reviewed head `f0f8f6f`).
- PR #15, the frozen sale-readiness ledger, merged into integration as
  `7add48b`.
- Current burn-down documentation branch:
  `codex/sale-readiness-burndown`, based on exact `7add48b`.
- Production `main` remains exact `8c38909`.

Before any new write, re-fetch and compare remote integration, remote main,
open PRs, and the working tree. Stop on an unexplained contradiction.

### Supabase staging

- Linked staging project ref: `qokaaggeqahayxsybgds`.
- Migrations 001–049 are applied and verified on staging.
- Migration 049 removed direct anonymous invoice/user reads while preserving the
  constrained Receipt and Storefront facades and checkout contract.
- The durable synthetic owner fixture documented in `MIGRATION_RUNBOOK.md`
  remains intentionally on staging. Do not print its phone, OTP, Auth ID, or
  shop ID, and do not delete it.
- The frozen matrix used prefix `SR-D74`; the burn-down used `SR-BD15`.
  Both sets were removed. Burn-down zero-readback covered products, customer,
  receipt/item, throwaway shop, onboarding probe, and test email Auth aliases;
  one durable active owner/shop remained.
- Staging Auth has a permanent callback fixture: Site URL is the stable
  integration preview alias and the allowlist retains localhost plus the
  staging-only Vercel preview wildcard documented in `MIGRATION_RUNBOOK.md`.
  Do not restore it during cleanup and never copy that wildcard to production.
- Migration 018 storage-bucket policy remains a separate pending decision.
  Customer/product image upload paths were not exercised in the sale-readiness
  run.

### Vercel staging preview

The exact preview used for the sale-readiness burn-down was:

- Deployment ID: `dpl_DrQt7XfU3z18aKEVoZ6f4a7fYDha`
- URL:
  `https://bharat-growth-5woo5mp3z-darshan-jahagirdars-projects.vercel.app`
- Stable alias:
  `https://bharat-growth-git-codex-pro-fbbd8e-darshan-jahagirdars-projects.vercel.app`
- State/type/region: READY / Preview / `bom1`
- Git branch/SHA: `codex/production-hardening-baseline` /
  `7add48b05a9f282948566e583bfed65ff7595eb4`
- Branch-scoped Preview variables: Supabase URL, anon key, and service-role key.
- No Meta/WhatsApp provider credentials were present. WhatsApp was exercised
  only as same-tab Web simulation; no message was sent.

Do not treat an arbitrary PR preview as staging evidence. Verify exact commit,
Preview state, and branch-scoped staging variables before login or mutations.

## 4. Supabase +91 Auth resolution

The repeated staging `+91` failure is resolved in integration.

Root cause:

- The app sent `91XXXXXXXXXX` without the leading plus.
- Supabase expects the client request in E.164 form (`+91…`) and internally
  strips `+` for the hosted Auth-user and fixed-OTP lookup.
- The staging fixed-OTP entry and Auth user therefore did not match the app
  request and Auth fell through to the disabled external provider.

Durable solution:

- `src/lib/auth/phone.ts` owns canonical India E.164 formatting.
- `src/lib/auth/useAuth.ts` sends `+91…`.
- Hosted staging Auth user and fixed OTP use Supabase-normalized country-code
  digits, with the durable owner/profile relationship preserved.
- Tests cover phone normalization and the Auth hook request.

Verification:

- Six-cell OTP entry plus Enter reached `/billing` on the exact staging preview.
- `npm test`, typecheck, lint, and build passed before and after the merge.
- Never reintroduce the raw-ten-digit or missing-plus workaround.

Email magic-link follow-up found a separate staging Auth configuration issue:
the Site URL still pointed to localhost. That ENV-CONFIG issue was permanently
corrected on staging and documented in the migration runbook. It is not an app
defect. A fresh delivery was then rate-limited, and the one authorized final
browser-tab recovery failed. Per Darshan's direction, Auth testing stopped and
remaining authenticated-only coverage is gated to the planned pre-launch Auth
rebuild.

## 5. Sale-readiness result

Canonical evidence:
`docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`.

Overall decision: **NO-GO**.

- The frozen point-in-time ledger remains 6/70 PASS and 64/70
  failed/incomplete. Do not rewrite it.
- The appended burn-down triage closes the runnable public/non-Auth gaps and
  records **one application defect**: unauthenticated `/settings` renders the
  protected navigation shell instead of redirecting to login.
- Coverage remaining after the burn-down is gated: planned Auth rebuild,
  Meta/provider configuration, production-only A6, migration-018 image scope,
  Darshan's post-reskin V1/V2 waiver, and explicit fault-injection/network-
  observability fixtures.
- The transaction engine itself passed its highest-risk flows: cash/UPI/card/
  khata persistence, overpayment rejection, loyalty accrual, stock movements,
  cross-tenant RPC rejection, negative-stock POS, strict online acceptance,
  SO→invoice, PO→bill, and one storefront checkout.
- No application-code or schema fix was made during the matrix.

Burn-down passes include `/progress` local persistence/reset, Storefront anon
surface and tracked/untracked mapping, Industrial/Festive dispatch and output,
Modern search/empty/clear, zero-stock and strict-stock error behavior,
missing-owner state, direct receipt/print/mobile/no-index rendering, and the
browser/runtime blocking-error sweep. Unauthenticated WhatsApp routes rejected
before any provider path; invalid webhook verification/signature requests were
also rejected.

Repository gates at the tested commit:

- `npm test`: 30 files / 143 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; 25 routes generated.

The defect and gates are evidence, not an invitation to fix them in the same
task. Scope `/settings` protection and the Auth rebuild separately, then rerun
the affected lines plus the full high-risk transaction subset.

## 6. Locked safety decisions

- No production access without a new explicit Darshan approval for the exact
  action and target.
- No key rotation in an ordinary feature, migration, or regression task.
- No real phone numbers or external message sends in test data.
- Staging mutations require synthetic, uniquely tagged fixtures and verified
  cleanup. The durable owner fixture is the explicit exception.
- WhatsApp remains simulation unless Darshan separately authorizes a provider
  send and the environment is proven non-production.
- Do not touch migration-018 customer-image storage until its bucket decision is
  separately reviewed.
- Record regression failures and continue the matrix; fixes require a separate
  scope.
- Never expose Supabase/Vercel secrets, OTPs, private fixture identities, or
  provider credentials in logs, docs, chat, commits, or PRs.

## 7. Collaboration artifacts

- Canonical Google handoff:
  `https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit`
- Slack milestone channel: `#bharatgrowth`
- Sale-readiness milestone:
  `https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784399937146619`
- Burn-down docs-only PR:
  `https://github.com/darshan-Jahagirdar/bharat-growth/pull/16`
- Signed burn-down milestone:
  `https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784406156886699`
- Milestone messages from this track are signed `— Sol/Codex`.

Update the Google handoff and Slack only for an actual merge, verified gate,
sale-readiness result, production decision, or genuine blocker. Include exact
commits, deployment identity, staging/production safety, result, and next gate.

## 8. Stop conditions

Stop and report before writes if any of these occur:

- remote integration or `main` contradicts the exact checkpoints above;
- an unexplained overlapping Claude/Codex branch changes the same scope;
- the linked Supabase target is not staging `qokaaggeqahayxsybgds`;
- migration history no longer matches 001–049;
- the intended preview is not exact-commit, READY, Preview-only, and staging-
  wired;
- a production endpoint, real customer identity, live provider send, secret,
  OTP, or private fixture would be required;
- cleanup cannot preserve the durable owner fixture;
- work would require touching an excluded user-owned path;
- a sale-readiness failure would have to be fixed without a separate scope.

## 9. Recommended next task

Start from the live successor of integration `7add48b`, verify `main` remains
`8c38909`, read the required documents, and choose one bounded failure cluster
from `SALE_READINESS_RESULTS.md`. Recommended first clusters are:

1. rebuild Auth as already planned, then replay A1–A5/A7 and every
   authenticated-only matrix line;
2. separately fix and verify DEFECT-01 (`/settings` route protection);
3. configure a bounded non-sending Meta simulation for the gated campaign and
   webhook lines;
4. add explicit fault-injection/network-observability fixtures;
5. image/AI work only after the migration-018 bucket decision.

Do not begin a production rollout. After a scoped fix, use a branch-scoped
staging preview, synthetic fixtures, zero-count cleanup readback, and a separate
docs-only handoff update.
