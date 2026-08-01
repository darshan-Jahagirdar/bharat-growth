# BharatGrowth Codex Handoff

Last updated: 2026-08-01 (IST)
Owner: Darshan
Maintainer signature: Sol/Codex

This is the canonical operating handoff for BharatGrowth. It records the exact
post-migration-050, post-email-OTP, post-Wave-A tag-taxonomy merge checkpoint.
It does not authorize production access, external-gate work, Waves B–E, or a
production rollout.

## 1. Product and branch model

BharatGrowth is a Next.js/Supabase/Vercel small-business ERP covering POS
billing, GST, customer loyalty and khata, inventory, purchase and sales orders,
campaigns, analytics, a public storefront, online checkout, and public receipts.

- Production Git branch: `main`
- Production Git checkpoint: `8c389098db7e31180b5bdd6f1661adfd4bdc902b`
- Immutable fallback tag: `pre-hardening-8c38909`
- Integration/staging branch: `codex/production-hardening-baseline`
- Current verified integration software commit after Wave A:
  `7722ca15522b75bcbd3f9613b724c1b5bc8e84d8`
- New work branches from a freshly verified remote integration SHA and PRs only
  back to integration unless Darshan separately authorizes production.

Production remained untouched throughout migrations 049–050, Auth
normalization, email OTP, the sale-readiness matrix, and Wave A. No production
Supabase or Vercel endpoint was accessed.

## 2. Required reading order

Read these completely before continuing work:

1. `docs/bharatgrowth/CODEX_HANDOFF.md`
2. `docs/bharatgrowth/product/CAPTURE_AND_TAGS_DESIGN.md`
3. `docs/bharatgrowth/COLLABORATION_WORKFLOW.md`
4. `docs/bharatgrowth/quality/BEHAVIOR_CONTRACTS.md`
5. `docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md`
6. `docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`
7. `docs/bharatgrowth/database/MIGRATION_049_PLAN.md`
8. `docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`
9. `docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`

Do not open, edit, stage, or infer from excluded user-owned paths:
`designs/`, `designs_mobile/`, `docs/bharatgrowth/design/`, and
`docs/bharatgrowth/CLAUDE_HANDOFF.md`.

## 3. Exact current checkpoint

### Git and GitHub

#### Auth PR 1 — merged into integration

- PR [#18](https://github.com/darshan-Jahagirdar/bharat-growth/pull/18)
  replaced email magic-link login with typed six-digit email OTP and
  squash-merged into integration as
  `3c83cac57dd2c438cbbfa2312926b4cb07c3b2e2` from reviewed head
  `f65cb3864e6378f6d376df107212fe123ee6e250`.
- New-user Confirm signup, returning-user Magic Link/OTP, and the frozen phone
  E.164 path passed staging Preview E2E. Neither email contained a magic-link
  URL, and no OTP or private identity was recorded.
- The staging Confirm signup and Magic Link templates remain code-only
  `{{ .Token }}` templates. Darshan owns Supabase dashboard changes; stop and
  give exact instructions if a future dashboard-only change is required.
- `/auth/callback` remains for the separately scoped Google OAuth PR 2. The
  product brand remains exactly `BharatGrowth`; the purchased
  `bharatgrowthshop.com` domain does not authorize DNS, sender, redirect,
  repository-copy, or production changes.

#### Wave A tag taxonomy — merged into integration

- PR [#19](https://github.com/darshan-Jahagirdar/bharat-growth/pull/19)
  targeted integration only and squash-merged as
  `7722ca15522b75bcbd3f9613b724c1b5bc8e84d8` from exact reviewed head
  `76dbee60f0e2d806e741a72bd7f3db698f91fe4e`. Its implementation head before
  the handoff-only evidence commit was
  `5b09596cf3a568d9f8d5c07cd7ddbb926f758571`.
- The exact base was Auth integration commit
  `3c83cac57dd2c438cbbfa2312926b4cb07c3b2e2`. At merge, PR #19 was
  ready-for-review, mergeable/CLEAN, and all four GitHub/Vercel checks were
  green.
- Wave A adds `grocery`, migration 050, the approved five-vertical taxonomy,
  sequential retrofit idempotency, and matching tests/docs. The seven
  pre-existing rules retain their exact definitions; the 22 additions use the
  approved verbatim definitions. All seeded rules remain inactive.
- Integration was merged into the Wave A branch after Auth PR 1. Post-merge
  local gates passed: 34/34 test files and 170/170 tests, strict typecheck,
  zero-warning lint, and optimized build with 25 routes.
- The campaign-engine boundary remained zero-diff against integration:
  `find_campaign_matches`, `message_logs`, `get_retention_stats`, the campaign
  cron path, and invoice attribution were unchanged.
- Exact Wave A Preview deployment:
  `dpl_G773SdevmLDdX5xDqApbnttQbN6g`,
  `https://bharat-growth-b1y8mk4j8-darshan-jahagirdars-projects.vercel.app`.
  It was READY, Preview-only, exact branch/head, contained staging ref
  `qokaaggeqahayxsybgds`, and contained no production ref.
- Grocery onboarding E2E passed through the six-digit email OTP path with a
  fresh disposable alias. `Wave A Grocery E2E` landed on Billing and displayed
  exactly seven grocery campaign rules, all inactive.
- Cleanup removed only that exact disposable grocery shop, its owner profile
  and Auth identity, seven tags, and seven rules. Guarded zero-readback returned
  zero target shops/profiles/tags/rules; unrelated staging shops and active
  owners remained. No credentials, private identity, or OTP were printed or
  persisted.
- The three existing sensitive Preview variables were restored by metadata-only
  PATCH to `gitBranch = codex/production-hardening-baseline`. Readback showed
  all three on integration and zero remaining on
  `codex/tag-taxonomy-wave-a`; their encrypted values were not copied.

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
- PR #18, typed six-digit email OTP, squash-merged into integration as
  `3c83cac` (reviewed head `f65cb386`).
- PR #19, Wave A tag taxonomy, squash-merged into integration as `7722ca1`
  (reviewed head `76dbee6`; implementation head `5b09596`).
- Current verified integration software checkpoint: `7722ca1`.
- Production `main` remains exact `8c38909`.

Before any new write, re-fetch and compare remote integration, remote main,
open PRs, and the working tree. Stop on an unexplained contradiction.

### Supabase staging

- Linked staging project ref: `qokaaggeqahayxsybgds`.
- Migrations 001–050 are applied and verified on staging. Migration 050 adds
  only `grocery` to the `shops.business_type` CHECK and was applied once; it was
  not reapplied after integration was merged into Wave A.
- Migration 049 removed direct anonymous invoice/user reads while preserving the
  constrained Receipt and Storefront facades and checkout contract.
- The durable synthetic owner fixture documented in `MIGRATION_RUNBOOK.md`
  remains intentionally on staging. Do not print its phone, OTP, Auth ID, or
  shop ID, and do not delete it.
- The frozen matrix used prefix `SR-D74`; the burn-down used `SR-BD15`.
  Both sets were removed. Burn-down zero-readback covered products, customer,
  receipt/item, throwaway shop, onboarding probe, and test email Auth aliases;
  one durable active owner/shop remained.
- The disposable `Wave A Grocery E2E` shop and its Auth identity were removed
  after onboarding verification with guarded zero-readback. Durable synthetic
  ownership infrastructure and unrelated staging shops were preserved.
- Staging Auth has a permanent callback fixture: Site URL is the stable
  integration preview alias and the allowlist retains localhost plus the
  staging-only Vercel preview wildcard documented in `MIGRATION_RUNBOOK.md`.
  Do not restore it during cleanup and never copy that wildcard to production.
- Migration 018 storage-bucket policy remains a separate pending decision.
  Customer/product image upload paths were not exercised in the sale-readiness
  run.

### Vercel staging preview

The exact post-Wave-A integration Preview is:

- Deployment ID: `dpl_8naG4mxYizXyGcdkdJ3GXj1XNxZk`
- URL:
  `https://bharat-growth-oyax4qh2w-darshan-jahagirdars-projects.vercel.app`
- State/type: READY / Preview (`target = null`)
- Git branch/SHA: `codex/production-hardening-baseline` /
  `7722ca15522b75bcbd3f9613b724c1b5bc8e84d8`
- The three existing sensitive Preview variables read back as encrypted,
  Preview-only, and scoped to integration. Zero remained on the closed Wave A
  branch.
- The compiled login bundle contains staging ref `qokaaggeqahayxsybgds`, no
  production ref, and the six-digit email OTP copy.
- The first Git-triggered merge deployment
  `dpl_5LwHzxyrc3PxbPrN9ASeMqgZUKPj` started before the variable metadata
  restore and compiled with the production ref. It was never used for login or
  a backend call. After restoring all three scopes, exact commit `7722ca1` was
  explicitly redeployed as the validated staging-wired Preview above.

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

Wave A is complete. Keep the remaining capture-and-tags work separately scoped
in the sequence approved by `CAPTURE_AND_TAGS_DESIGN.md`:

1. **Wave B:** campaign approval gate.
2. **Wave C:** visit log plus `message_logs` /
   `find_campaign_matches` generalization.
3. **Wave D:** visit capture UI and thank-you message.
4. **Wave E:** CSV auto-tagging.

Do not begin any of Waves B–E without a fresh branch, staging plan, cleanup
plan, risk review, and Darshan's explicit scope approval. Production `main`
remains exact `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
