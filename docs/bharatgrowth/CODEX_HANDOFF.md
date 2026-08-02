# BharatGrowth Codex Handoff

Last updated: 2026-08-02 (IST)
Owner: Darshan
Maintainer signature: Sol/Codex

This is the canonical operating handoff for BharatGrowth. It records the exact
post-migration-056, post-access-approval checkpoint plus email OTP, Waves A–D,
the Claude design/frontend track, receipt-loyalty hardening, and the access
gate. It does not authorize production access, DNS/domain changes, Wave E, or a
production rollout.

## 1. Product and branch model

BharatGrowth is a Next.js/Supabase/Vercel small-business ERP covering POS
billing, GST, customer loyalty and khata, inventory, purchase and sales orders,
campaigns, analytics, a public storefront, online checkout, and public receipts.

- Production Git branch: `main`
- Production Git checkpoint: `8c389098db7e31180b5bdd6f1661adfd4bdc902b`
- Immutable fallback tag: `pre-hardening-8c38909`
- Integration/staging branch: `codex/production-hardening-baseline`
- Current verified integration software commit after the access approval gate:
  `cedcaeee49c194169654e11aa661759ff8895939`
- New work branches from a freshly verified remote integration SHA and PRs only
  back to integration unless Darshan separately authorizes production.

Production remained untouched throughout migrations 049–056, Auth
normalization, email OTP, the sale-readiness matrix, Waves A–D, the Claude
design/frontend merges, receipt-loyalty hardening, and the access approval
gate. No production Supabase or Vercel endpoint was mutated.

## 2. Required reading order

Read these completely before continuing work:

1. `docs/bharatgrowth/CODEX_HANDOFF.md`
2. `docs/bharatgrowth/product/ACCESS_APPROVAL_DESIGN.md`
3. `docs/bharatgrowth/product/CAPTURE_AND_TAGS_DESIGN.md`
4. `docs/bharatgrowth/COLLABORATION_WORKFLOW.md`
5. `docs/bharatgrowth/quality/BEHAVIOR_CONTRACTS.md`
6. `docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md`
7. `docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`
8. `docs/bharatgrowth/database/MIGRATION_049_PLAN.md`
9. `docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`
10. `docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`

Do not open, edit, stage, or infer from excluded user-owned paths:
`designs/`, `designs_mobile/`, `docs/bharatgrowth/design/`, or
`docs/bharatgrowth/LAUNCH_PLAN.md`. `docs/bharatgrowth/CLAUDE_HANDOFF.md` is
now tracked and may arrive through Claude-owned branches, but Codex must not
edit its contents.

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

#### Wave B campaign approval gate — merged into integration

- PR [#21](https://github.com/darshan-Jahagirdar/bharat-growth/pull/21)
  targeted integration only and squash-merged as
  `74c785279abf63705a4a506da007a6bd5f47f95a` from exact reviewed head
  `5d53ba7ac46a7ec3c3db7268749c2d1c3c8d920a`. Its exact base was the
  post-Wave-A handoff checkpoint
  `ee882aee00cff2f8c8d2a1656600400c9a0c53db`.
- Migration 051 adds `campaigns_approved`,
  `campaigns_approved_at`, and `campaigns_approval_requested_at` to `shops`.
  Existing and new shops deliberately default to unapproved.
- A narrow `BEFORE UPDATE` trigger raises SQLSTATE `42501` if `anon` or
  `authenticated` attempts to alter `campaigns_approved` or
  `campaigns_approved_at`. Shops may update only the request timestamp through
  the existing row-scoped update policy; privileged roles retain the manual
  approval path.
- `find_campaign_matches` retains its exact 11-column return signature and all
  prior consent, dedupe, cooldown, per-customer, and daily-cap guards. Its only
  behavioral addition is the approved-shop join predicate.
- The Campaigns page now renders not-requested, pending, and approved states.
  Shops can keep using the existing recommended-rule creation, Enable All, and
  toggle controls while approval is pending; no rule editor or admin UI was
  added. Dashboard Bring-Back copy is also approval-aware.
- Repository gates passed at the reviewed head: 36/36 test files and 179/179
  tests, strict typecheck, zero-warning lint, and optimized build with 25
  routes.
- Migration 051 was applied only to staging. The committed reusable harness
  `supabase/tests/051_campaign_approval_gate.sql` proved zero RPC rows while
  unapproved and the expected normal match after privileged approval. It
  removed only its uniquely tagged disposable fixtures, verified zero
  remaining fixture shops, and preserved the durable staging fixture.
- Exact Wave B branch Preview:
  `dpl_CJwy2TzyzBdSyYXqivNKR5UFRtTt`,
  `https://bharat-growth-9xull2jsu-darshan-jahagirdars-projects.vercel.app`.
  It was READY, Preview-only, exact branch/head, and staging-wired.
- Before merge, the three encrypted Preview variables were restored by
  metadata-only PATCH to `codex/production-hardening-baseline`. Readback proved
  exactly three on integration and zero on `codex/campaign-approval-wave-b`.
  The merge-triggered integration Preview therefore inherited staging scope
  without the Wave A race.

#### Wave C visit log and attribution generalization — merged into integration

- PR [#23](https://github.com/darshan-Jahagirdar/bharat-growth/pull/23)
  targeted integration only and squash-merged as
  `7ba7fd5ccd5d12a69e65bea42cf981519760269e` from exact reviewed head
  `44adafba8ee921b5249eedcffa31b8542db965a0`. Its exact base was the
  post-Wave-B handoff checkpoint
  `527ebc0df28b3ec71560a3381c1564f228eb0deb`.
- The required characterization-only checkpoint was committed before any
  schema or application change as
  `50c60da2763af41e69a55291eb290574637789c8`. The existing invoice path
  proved its trigger window, two-day grace boundary, marketing-consent filter,
  source/rule dedupe, seven-day cooldown, one-message-per-customer-per-run,
  per-shop daily cap, and Wave B approval gate.
- Migration 052 adds RPC-only, append-only `customer_visits` with exactly one
  optional tag and no amount, line item, or inventory effect. The
  `log_customer_visit` RPC validates tenant ownership, preserves affirmative
  consent, never changes spend, awards a hardcoded flat one loyalty point, and
  applies the existing 14-day conversion-attribution behavior.
- `message_logs` now accepts exactly one source, invoice or visit, with separate
  partial unique indexes. `find_campaign_matches` unions both sources before
  global ranking and capping, keeps every prior guard, and prefers invoice
  matches on same-day ties. The cron consumer validates and writes the source
  XOR in the same change.
- Retention counts every converted customer while revenue remains completed-
  invoice-only. `save_invoice` remains behaviorally unchanged. A rare
  concurrent invoice/visit attribution race may leave both conversion
  references populated; this is documented and deliberately does not make a
  bill save fail.
- The committed staging harness first reproduced the unchanged invoice
  baseline, then proved visit approval/window/grace/consent/dedupe/cooldown,
  cross-source ranking and cap behavior, source constraints, RPC tenancy,
  identity/consent preservation, flat loyalty, zero spend/stock side effects,
  attribution boundaries, and retention semantics. It ran in transactions
  ending in rollback, and guarded readback found zero Wave C fixture shops and
  Auth users.
- Repository gates passed at the reviewed head: 37/37 test files and 184/184
  tests, strict typecheck, zero-warning lint, and optimized build.
- Migration 052 was applied only to staging. Staging migration history is
  exactly 001–052.
- Exact Wave C branch Preview:
  `dpl_8P8HdZZbb4MFHz1bC5f1kyHW6qLY`,
  `https://bharat-growth-5u1axlxc0-darshan-jahagirdars-projects.vercel.app`.
  It was READY, Preview-only, exact branch/head, and staging-wired.
- Before merge, the three encrypted Preview variables were restored by
  metadata-only PATCH to `codex/production-hardening-baseline`. Readback proved
  exactly three on integration and zero on
  `codex/visit-attribution-wave-c`.

#### Wave D visit capture and acknowledgement — merged into integration

- PR [#25](https://github.com/darshan-Jahagirdar/bharat-growth/pull/25)
  targeted integration only and squash-merged as
  `77cd697414250adca559da9e1db84ce56eee9c81` from exact reviewed head
  `8612d693bcca440c9dd2920e7cc4e6f6dc5af6b5`. Its exact base was the
  post-Wave-C handoff checkpoint
  `cc1f5dc64d85a8cf2edb6cb0134e247ccd1351aa`.
- Migration 053 makes visit creation request-idempotent and adds a durable,
  service-only one-per-visit acknowledgement claim outside campaign-attribution
  `message_logs`. A replay returns before customer, consent, loyalty,
  attribution, or acknowledgement side effects.
- Migration 054 makes data-collection consent unconditional for every new
  visit, OR-preserves both consent flags, append-logs data and optional
  WhatsApp-marketing purposes separately, and excludes anonymized customers or
  a later explicit data withdrawal from its backfill. It introduced no
  caller-supplied data-consent, amount, item, points, stock, or inventory input.
- Staging backfill aggregate readback found six non-erased visited customers
  with data consent, six migration audit rows, zero eligible false rows
  remaining, and zero explicit withdrawals overwritten. The rollback harness
  then passed its invoice, visit, replay, two-purpose consent, loyalty,
  attribution, approval, claim, privilege, and forbidden-side-effect
  assertions. Staging migration history is continuous 001–054.
- The billing header has an independent **Visit** action with `F6`; existing
  F2/F3/F4/F5/F8 shortcuts and bill-draft behavior remain unchanged. New and
  returning capture reuse the characterized customer search without reading,
  changing, or clearing the in-progress bill.
- The WhatsApp acknowledgement carries the flat one-point balance and requires
  both independent gates: `shops.campaigns_approved = true` and persisted
  customer marketing consent. Simulation redacts template variables; partial
  Meta credentials fail closed. Acknowledgements never enter `message_logs`.
- Counter marketing consent is recorded verbally and defaults checked in both
  Visit and billing customer creation. Operators can untick a decline. The
  known residual risk is a false record when a shop fails to ask; later
  provenance and monitoring controls remain separately scoped.
- Dashboard instrumentation reports observable **Customer captures** and
  **Bills with customer** for the selected IST range, with `— / No bills`
  rather than a fabricated zero-denominator rate.
- Repository gates passed at the reviewed head: 42/42 test files and 215/215
  tests, strict typecheck, zero-warning lint, optimized build with 26 routes,
  and `git diff --check`. All four GitHub/Vercel checks were green.
- Exact final Wave D branch Preview:
  `dpl_9872jvBcUYv8HHaThiiiBdwBz2j8`,
  `https://bharat-growth-36hs6hc4d-darshan-jahagirdars-projects.vercel.app`.
  It was READY, Preview-only, exact branch/head, and its eight compiled browser
  chunks contained staging ref `qokaaggeqahayxsybgds` once and no production
  ref. Darshan completed the requested manual Preview pass before closeout.
- Before merge, the three encrypted Preview variables were restored by
  metadata-only PATCH to `codex/production-hardening-baseline`. Readback proved
  exactly three on integration and zero on `codex/visit-capture-wave-d`, so the
  merge-triggered integration deployment inherited staging scope.

#### Claude design/frontend track — merged into integration

- Five frontend-only PRs targeted integration and merged in the required
  stacked order. None added migrations, schema, RLS, API routes, or `src/lib`
  changes:
  - [#26](https://github.com/darshan-Jahagirdar/bharat-growth/pull/26),
    `claude/design-foundation` head
    `90f404cf56ad3e05fc0152ecd2511daa3f53834f`, merged as
    `871a4aad430e7756edb756868b430818a75833fe`;
  - [#27](https://github.com/darshan-Jahagirdar/bharat-growth/pull/27),
    `claude/fix-donut-chart` head
    `b28d3eec6e949e367b253235e79c4a646d6f0c34`, merged as
    `b897d6d62799bcc1829a3a6ae89f9491d3d4a287`;
  - [#28](https://github.com/darshan-Jahagirdar/bharat-growth/pull/28),
    `claude/landing-page` head
    `13c66cbb9a12d73c884380d5786b6d25537e5df9`, merged as
    `3e233e57f842658daed0c3bd4e3954da13581088`;
  - [#29](https://github.com/darshan-Jahagirdar/bharat-growth/pull/29),
    `claude/dashboard` head
    `cdb17f01d565aaa067d2063193f541af31b2c036`, merged as
    `122aaf5383071450194aa5e6b825dcf155ab9d41`;
  - [#30](https://github.com/darshan-Jahagirdar/bharat-growth/pull/30),
    `claude/mobile-surfaces` head
    `14107e017d676e03ebd1e78ea8347a140c36d64c`, merged as
    `2566d9df4fb949dfb2595ccbc40352161cb10960`.
- The foundation adds Space Grotesk, Hanken Grotesk, JetBrains Mono, and shared
  surface tokens. The landing page is rewritten, the collapsed Top Products
  donut is fixed, the dashboard and Bring-Back ROI card are restyled, and the
  Modern storefront plus public receipt are reskinned.
- The surface branches retained their single-commit diffs because the two
  foundation commits merged first. Before every merge the exact head and
  current base were confirmed, the tracked tree was clean, and quality,
  public-smoke, Vercel, and Vercel Preview Comments were green.
- `docs/bharatgrowth/CLAUDE_HANDOFF.md` became tracked through the foundation
  branch and remained byte-identical after all five merges; Codex did not edit
  it. The excluded `designs/`, `designs_mobile/`, and
  `docs/bharatgrowth/design/` paths remained untracked and untouched.
- No per-branch staging verification or Vercel variable rescoping was
  performed. The one final integration Preview at exact design-track tip
  `2566d9df4fb949dfb2595ccbc40352161cb10960` was READY, Preview-only, and
  staging-wired.

- The frontend continuation then merged:
  - [#31](https://github.com/darshan-Jahagirdar/bharat-growth/pull/31),
    landing hero motion head
    `e7349c7312738cf9d653f199d034c7ff87b5f572`, merged as
    `5a4d40903d330d0aca873f06a9c91008d0977137`;
  - [#33](https://github.com/darshan-Jahagirdar/bharat-growth/pull/33),
    design accents and receipt-loyalty UI head
    `bf26f9c26e6ca8ffa3f26db360982219edebcec6`, merged as
    `80ba4dc5168ee41786fd69af63bba1314fd8f195`.
- [#32](https://github.com/darshan-Jahagirdar/bharat-growth/pull/32)
  added migration 055 and the receipt-loyalty backend from head
  `8aa17c2dcc2084bcfc379029fc44daff67ba23d7`, merged as
  `ccc97939f7cf5cf0170ab205461c292bd39902cd`. It exposes invoice-earned points
  and the stored post-invoice balance only through `get_public_receipt`, and
  removes every unintended direct anon table grant while preserving migration
  049's three exact storefront column allowlists.

#### Access approval gate — merged into integration

- PR [#34](https://github.com/darshan-Jahagirdar/bharat-growth/pull/34)
  targeted integration only and merged as
  `cedcaeee49c194169654e11aa661759ff8895939` from exact reviewed software head
  `0d3ebad5f6c12f45843c08741a50d883a8b5707b`. Its exact base was
  `80ba4dc5168ee41786fd69af63bba1314fd8f195`.
- Migration 056 adds `access_requests` with forced RLS, own pending INSERT,
  own status SELECT, exact column grants, and a loud SQLSTATE `42501`
  `BEFORE UPDATE` review guard. INSERT cannot supply decision/audit fields,
  and the own-row UPDATE policy deliberately lets protected writes reach the
  trigger rather than succeed with zero affected rows.
- Access approval and `shops.campaigns_approved` are independent. Migration
  056 never touches `shops`; the onboarding shop INSERT continues to inherit
  `campaigns_approved = false`.
- `/onboarding` is a three-state server router: request form, pending message
  (also used for dismissed), or the preserved existing onboarding form after
  approval. Existing users with `users.shop_id` remain grandfathered.
- The service-role `POST /api/onboarding` independently requires the caller's
  request to be approved immediately before shop creation. Server layouts also
  redirect profile-less `/billing` and `/dashboard` users to onboarding;
  middleware remains database-free.
- `/admin` is unlinked, request-dynamic, and noindex. Page load and every
  approve/dismiss action freshly compare the verified auth email against
  server-only `PLATFORM_ADMIN_EMAIL`, case-insensitively. Pending-only updates
  make actions race/replay safe.
- Approval commits before the direct Resend courtesy email. Missing
  configuration, network failure, or provider rejection is logged and cannot
  roll back approval. `RESEND_FROM_EMAIL` is configurable and initially
  `hello@bharatgrowthshop.com`; production still needs real server-only
  `PLATFORM_ADMIN_EMAIL` and `RESEND_API_KEY` values before rollout.
- Dismissed status remains technically visible through the user's RLS-scoped
  status SELECT while the product UI presents it as pending. This accepted
  observability is documented in `ACCESS_APPROVAL_DESIGN.md`.
- Repository gates passed at the reviewed head: 51/51 test files and 260/260
  tests, strict typecheck, zero-warning lint, optimized build with 27 routes,
  and all four GitHub/Vercel checks green.
- Migration 056 was applied only to staging. The rollback harness proved own
  pending INSERT/SELECT, cross-user and pre-approved INSERT denial, loud status
  and review-time UPDATE denial, privileged approval, zero shop membership
  creation, and transaction-backed fixture cleanup. History is continuous
  001–056.
- Exact feature-branch Preview:
  `dpl_BDh5yoyogKuHef7TEYZA96ggs9EH`,
  `https://bharat-growth-gqswyb8t2-darshan-jahagirdars-projects.vercel.app`.
  It was READY, Preview-only, exact software head, and its eight login chunks
  contained staging ref `qokaaggeqahayxsybgds` once and no other Supabase ref.
- Before merge, all three Wave branch Preview overrides were removed. Readback
  proved exactly three on integration and zero on the Wave branch, so the
  merge-triggered integration deployment inherited staging scope.

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
- PR #21, Wave B campaign approval gate, squash-merged into integration as
  `74c7852` (reviewed head `5d53ba7`).
- PR #23, Wave C visit log and attribution generalization, squash-merged into
  integration as `7ba7fd5` (reviewed head `44adafb`; characterization
  checkpoint `50c60da`).
- PR #25, Wave D visit capture and acknowledgement, squash-merged into
  integration as `77cd697` (reviewed head `8612d69`).
- PRs #26–#30, the Claude design/frontend track, merged sequentially into
  integration with final software checkpoint `2566d9d`.
- PR #31, landing hero motion, merged as `5a4d409`.
- PR #32, public receipt loyalty and anonymous-grant cleanup, merged as
  `ccc9793`.
- PR #33, design accents and receipt loyalty UI, merged as `80ba4dc`.
- PR #34, access approval gate, merged as `cedcaee` from reviewed head
  `0d3ebad`.
- Current verified integration software checkpoint: `cedcaee`.
- Production `main` remains exact `8c38909`.

Before any new write, re-fetch and compare remote integration, remote main,
open PRs, and the working tree. Stop on an unexplained contradiction.

### Supabase staging

- Linked staging project ref: `qokaaggeqahayxsybgds`.
- Migrations 001–056 are applied and verified on staging. Migration 050 adds
  only `grocery` to the `shops.business_type` CHECK. Migration 051 adds the
  campaign approval columns, loud self-approval trigger, and approved-shop
  matching predicate. Migration 052 adds append-only visit capture and
  generalizes campaign source and conversion attribution without recording
  visit amounts or moving inventory. Migration 053 adds request idempotency and
  a separate acknowledgement claim. Migration 054 makes visit data consent
  required and separately append-logged. Migration 055 restores the exact
  anonymous grant allowlist and widens only the constrained receipt RPC with
  stored loyalty values. Migration 056 adds the independent access-request
  gate and loud self-review boundary.
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
- The Wave B SQL harness completed inside an isolated transaction and its
  guarded post-run readback found zero uniquely tagged fixture shops.
- The extended Wave C harness reproduced the invoice baseline unchanged and
  passed its visit/RPC assertions inside rollback-only transactions. Guarded
  post-run readback found zero Wave C fixture shops and Auth users.
- The Wave D extension proved request replay, acknowledgement isolation, exact
  approval/marketing gates, required visit data consent for both new and
  existing customers, separate append-only purpose logs, and no amount/item/
  stock side effects. Its final staging run rolled back cleanly.
- The migration 056 harness proved both allowed request operations and loud
  review denials under the authenticated role, then privileged approval with
  no shop membership side effect. Its transaction rolled back cleanly.
- Staging Auth has a permanent callback fixture: Site URL is the stable
  integration preview alias and the allowlist retains localhost plus the
  staging-only Vercel preview wildcard documented in `MIGRATION_RUNBOOK.md`.
  Do not restore it during cleanup and never copy that wildcard to production.
- Migration 018 storage-bucket policy remains a separate pending decision.
  Customer/product image upload paths were not exercised in the sale-readiness
  run.

### Vercel staging preview

The exact post-access-gate integration Preview is:

- Deployment ID: `dpl_6iVD6AgH3RTuufToX3T1ZrRqJ9pS`
- URL:
  `https://bharat-growth-jvrrmxkl7-darshan-jahagirdars-projects.vercel.app`
- State/type: READY / Preview (`target = null`)
- Git branch/SHA: `codex/production-hardening-baseline` /
  `cedcaeee49c194169654e11aa661759ff8895939`
- The three existing sensitive Preview variables read back as encrypted,
  Preview-only, and scoped to integration. No scoping changes were made for the
  frontend-only design track.
- The eight compiled login chunks contain staging ref `qokaaggeqahayxsybgds` once
  and no production ref across all eight browser chunks.

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
- Access approval gate PR:
  `https://github.com/darshan-Jahagirdar/bharat-growth/pull/34`
- Signed access approval milestone:
  `https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1785690975164029`
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
- migration history no longer matches 001–056;
- the intended preview is not exact-commit, READY, Preview-only, and staging-
  wired;
- a production endpoint, real customer identity, live provider send, secret,
  OTP, or private fixture would be required;
- cleanup cannot preserve the durable owner fixture;
- work would require touching an excluded user-owned path;
- a sale-readiness failure would have to be fixed without a separate scope.

## 9. Open work and recommended next task

Waves A–D and the access approval gate are complete.

- **Production access-gate configuration:** before the separately authorized
  production/domain rollout, set server-only `PLATFORM_ADMIN_EMAIL` and
  `RESEND_API_KEY`, and set `RESEND_FROM_EMAIL` to
  `hello@bharatgrowthshop.com`. The code fails closed without admin identity;
  approval itself remains committed if email delivery fails.

- **POS consent debt:** POS billing customer creation omits
  `dpdp_data_consent` and its `data_collection` consent log. Fix likely
  requires a transactional RPC because the current path is client-side with a
  non-transactional audit write. Scoped separately; touches Wave 1
  characterized behaviour.
- **Wave E:** CSV auto-tagging remains separately scoped and requires fresh
  characterization and Darshan's explicit approval.

Production `main` remains exact
`8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
