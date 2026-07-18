# BharatGrowth Codex Handoff

Last updated: 2026-07-18 (IST)
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
- Current verified integration commit: `d74ca83a7c243861de2404bacd154e1c97e4dcad`
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
- Current local documentation branch for this checkpoint:
  `codex/sale-readiness-results`, based on exact `d74ca83`.
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
- Disposable sale-readiness fixtures used prefix `SR-D74` and were removed.
  Readback after cleanup was zero for products, tags, customers, consent logs,
  invoices, sales orders, purchase orders, and purchase bills; one durable
  active owner/shop remained.
- Migration 018 storage-bucket policy remains a separate pending decision.
  Customer/product image upload paths were not exercised in the sale-readiness
  run.

### Vercel staging preview

The exact preview used for Auth and sale-readiness testing was:

- Deployment ID: `dpl_3MgaeN8bEnUtbJavXYpsdeK6ZETB`
- URL:
  `https://bharat-growth-ovco7s48f-darshan-jahagirdars-projects.vercel.app`
- State/type/region: READY / Preview / `bom1`
- Git branch/SHA: `codex/production-hardening-baseline` /
  `d74ca83a7c243861de2404bacd154e1c97e4dcad`
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

## 5. Sale-readiness result

Canonical evidence:
`docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`.

Overall decision: **NO-GO**.

- 6 of 70 manual checklist lines passed in full.
- 64 of 70 failed or were only partially exercised.
- The transaction engine itself passed its highest-risk flows: cash/UPI/card/
  khata persistence, overpayment rejection, loyalty accrual, stock movements,
  cross-tenant RPC rejection, negative-stock POS, strict online acceptance,
  SO→invoice, PO→bill, and one storefront checkout.
- No application-code or schema fix was made during the matrix.

Important incomplete gates include email/onboarding, complete Auth/keyboards,
IGST/composition/rounding, UPI QR confirmation, image/CSV/AI paths, campaigns
and WhatsApp negative routes, full storefront themes/errors, direct receipt
layout capture, pixel comparison, and console/runtime-log evidence.

Repository gates at the tested commit:

- `npm test`: 30 files / 143 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; 25 routes generated.

The failures are evidence, not an invitation to fix them in the same task.
Scope follow-up fixes separately and rerun the affected lines plus the full
high-risk transaction subset.

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

Start from the live successor of integration `d74ca83`, verify `main` remains
`8c38909`, read the required documents, and choose one bounded failure cluster
from `SALE_READINESS_RESULTS.md`. Recommended first clusters are:

1. complete Auth/onboarding negative-path evidence;
2. billing keyboard + IGST/composition + UPI QR confirmation;
3. receipt/storefront theme and error-state capture;
4. campaigns/WhatsApp simulation and negative-route matrix;
5. image/AI work only after the migration-018 bucket decision.

Do not begin a production rollout. After a scoped fix, use a branch-scoped
staging preview, synthetic fixtures, zero-count cleanup readback, and a separate
docs-only handoff update.
