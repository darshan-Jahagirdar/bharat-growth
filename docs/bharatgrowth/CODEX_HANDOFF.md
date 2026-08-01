# BharatGrowth Codex Handoff

Last updated: 2026-07-24 (IST)
Owner: Darshan
Maintainer signature: Sol/Codex

This is the canonical operating handoff for BharatGrowth. It records the exact
post-migration-049, post-sale-readiness closeout checkpoint plus the active
email-OTP PR 1 work described below. It does not authorize production access,
external-gate work, or a production rollout.

## 1. Product and branch model

BharatGrowth is a Next.js/Supabase/Vercel small-business ERP covering POS
billing, GST, customer loyalty and khata, inventory, purchase and sales orders,
campaigns, analytics, a public storefront, online checkout, and public receipts.

- Production Git branch: `main`
- Production Git checkpoint: `8c389098db7e31180b5bdd6f1661adfd4bdc902b`
- Immutable fallback tag: `pre-hardening-8c38909`
- Integration/staging branch: `codex/production-hardening-baseline`
- Last verified integration commit:
  `524047a5d9968e262e43daf52cdd204b32950f26`
- New work branches from a freshly verified remote integration SHA and PRs only
  back to integration unless Darshan separately authorizes production.

Production remained untouched throughout migrations 049, Auth normalization,
the sale-readiness matrix, and closeout. No production Supabase or Vercel
endpoint was accessed.

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

#### Auth PR 1 worktree — continue here first

- Working branch: `codex/email-otp-auth`, created from exact integration
  `524047a5d9968e262e43daf52cdd204b32950f26`.
- Intended approved change: replace the email magic-link UI with typed six-digit
  email OTP while retaining `signInWithOtp({ email })`; verification uses
  `verifyOtp({ email, token, type: 'email' })`. The existing phone E.164 contract
  remains frozen. `/auth/callback` remains for the separately scoped Google
  OAuth PR 2.
- Current tracked edits are limited to `src/app/login/page.tsx`,
  `src/lib/auth/useAuth.ts`, focused Auth/login tests, and the four matching
  behavior/runbook/checklist documents. The new untracked test directory is
  `src/app/login/__tests__/`. Preserve all unrelated user-owned untracked paths.
- Darshan enabled staging custom SMTP through Resend and manually saved both
  Confirm signup and Magic Link templates with the exact code-only
  `{{ .Token }}` content in `MIGRATION_RUNBOOK.md`. Darshan verified both on
  reload with no confirmation-link URL. Do not operate the Supabase dashboard;
  stop and guide Darshan if a later dashboard-only action is required.
- Full local gates at this worktree state: `npm test` passed 32/32 files and
  149/149 tests; strict `npm run typecheck` passed; zero-warning
  `npm run lint -- --max-warnings=0` passed; optimized `npm run build` passed.
  `src/lib/auth/phone.ts` is byte-identical to the branch base.
- Remaining sequence: commit and push only the scoped Auth work, PR into
  integration, confirm green CI and a READY staging-wired branch Preview, run
  new-identity and existing-identity email OTP E2E without recording either
  code, clean disposable Auth identities with zero readback, update this
  evidence, merge, update the canonical Google handoff, post one signed
  `#bharatgrowth` milestone, confirm production remains untouched, and stop.
- The product brand remains exactly `BharatGrowth`. Darshan purchased
  `bharatgrowthshop.com`; that domain is context only and does not authorize a
  product rename, DNS/domain change, Supabase URL change, sender change,
  repository copy change, or production mutation.

- PR #12, storefront loader → owner-phone RPC, merged at `3cca263`.
- PR #13, migration 049, merged into integration.
- Post-049 integration checkpoint before Auth work: `e5147d1`.
- PR #14, canonical E.164 India phone normalization, merged into integration as
  `d74ca83` (reviewed head `f0f8f6f`).
- PR #15, the frozen sale-readiness ledger, merged into integration as
  `7add48b`.
- PR #16, the sale-readiness burn-down and triage addendum, squash-merged into
  integration as `43cae2e` (reviewed head `ed146357`).
- PR #17, the `/settings` authentication guard, squash-merged into integration
  as `c6ac481` (reviewed head `f01f921`).
- Current verified integration software checkpoint: `c6ac481`.
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

The exact post-merge integration preview verified at sale-readiness closeout is:

- Deployment ID: `dpl_HGFd9jsuihW51NUnFwttpza7qeU3`
- URL:
  `https://bharat-growth-r0d28delj-darshan-jahagirdars-projects.vercel.app`
- Stable alias:
  `https://bharat-growth-git-codex-pro-fbbd8e-darshan-jahagirdars-projects.vercel.app`
- State/type/region: READY / Preview / `bom1`
- Git branch/SHA: `codex/production-hardening-baseline` /
  `c6ac481756b48da7cb8b9be85c5eb54a955a9ab3`
- Branch-scoped Preview variables: Supabase URL, anon key, and service-role key.
- Compiled login bundles contain staging ref `qokaaggeqahayxsybgds` and no
  production ref.
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
the completed sale-readiness closeout does not carry a separate Auth rebuild as
a launch blocker. Remaining launch work is limited to the external-gate queue
in section 9.

## 5. Sale-readiness result

Canonical evidence:
`docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`.

Overall decision: **SALE-READINESS COMPLETE — SOFTWARE LAUNCH-READY**.

- The frozen point-in-time ledger remains historical evidence and must not be
  rewritten.
- The burn-down closed the runnable staging coverage and found **one application
  defect**: unauthenticated `/settings` rendered the protected shell.
- That defect is fixed by PR
  [#17](https://github.com/darshan-Jahagirdar/bharat-growth/pull/17):
  `/settings` now uses the established protected-route redirect to
  `/login?next=/settings`, with focused unauthenticated and authenticated
  coverage plus exact-head staging Preview verification.
- Remaining pre-launch work is external gates only: Meta configuration and
  templates, the production monitoring test event, rate limiting, key rotation,
  and the migration-018 bucket decision. After those gates, the only remaining
  launch action is the single approved staged-then-production rollout.
- Darshan's V1/V2 visual waiver remains recorded until the post-reskin pass and
  does not block this software sale-readiness closeout.
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

- `npm test`: 31 files / 145 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; 25 routes generated.

The `/settings` defect was fixed under its separately approved scope and merged
only after local gates and authenticated/unauthenticated staging verification.
This closeout does not authorize any remaining external gate or rollout action.

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
- `/settings` auth-guard PR:
  `https://github.com/darshan-Jahagirdar/bharat-growth/pull/17`
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

Resume the active Auth PR 1 block in §3. Publish the scoped branch, open its PR
only into integration, confirm green checks and a staging-wired READY Preview,
then complete both new-identity and existing-identity email OTP E2E cases with
disposable Gmail `+alias` addresses. Confirm each email contains a six-digit
code and no magic-link URL without printing the code, clean both Auth identities
with zero readback, merge, update this handoff plus the canonical Google handoff,
and post one signed `#bharatgrowth` milestone. Stop after that merge; Google
OAuth is PR 2 and separately scoped.

After Auth PR 1, scope each remaining external gate separately with fresh
Darshan approval:

1. Meta configuration and approved templates;
2. the production monitoring test event;
3. rate limiting;
4. key rotation;
5. the migration-018 storage-bucket decision;
6. only after those gates, the single approved staged-then-production rollout.

Do not start any of these items from this closeout task. Each requires its own
target, safety checks, evidence, cleanup or rollback plan, and explicit approval.
