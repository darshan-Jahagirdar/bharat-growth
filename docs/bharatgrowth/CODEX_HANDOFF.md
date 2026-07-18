# BharatGrowth Codex Handoff

Last verified from disk and live read-only checks: 2026-07-18
(Asia/Kolkata).

This is the first file the next Codex task must read, completely. It is a
continuation handoff, not permission to re-plan the product or begin production
work. Do not trust remembered, compacted, conversational, or agent-authored
state. Re-derive every drift-prone fact below before acting. If local disk,
remote Git, GitHub, Supabase, Vercel, Google Drive, or Slack contradicts this
handoff, stop and report the mismatch before any write.

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

Read the full source-backed product contract in
[`product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](product/FEATURE_AND_BEHAVIOR_INVENTORY.md).
It explains why every existing feature exists and distinguishes implemented
behavior from planned or externally gated capability. Do not turn a landing-page
claim, roadmap item, design package, audit suggestion, or post-decomposition
candidate into application behavior without a separate approved scope.

## 2. Program status and why the current gate matters

The production-hardening foundation and all seven behavior-preserving
decomposition waves are complete, merged only into the integration branch, and
verified on staging. The final Wave 7 merge is
`053abca608bfa9e3d95c847b8a9481c847c3a76f`. Production `main` remains at the
pre-hardening commit `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.

The decomposition goal was to clarify ownership and make behavior safer to
change before the first real customer. It was not a redesign, feature sprint,
schema rewrite, Auth rewrite, or production release. The completed result now
has:

- thin Billing, Orders, Products, Dashboard, Purchases, and Storefront
  composition surfaces;
- focused transforms, controllers/hooks, and views for Waves 1–6;
- four stable data-access compatibility facades whose implementation is split
  by cohesive use case for Wave 7;
- characterization and verification evidence for the preserved product
  behavior and query shape.

The next session must not assume “all waves complete” means “deploy now.” A new
explicit Darshan scope is required. The approved engineering sequence identifies
the Storefront public-consumer audit and migration 049 staging contract gate as
the next production-hardening step. The intentional Storefront redesign,
Auth/provider work, payment-gateway work, sale-readiness regression, external
Meta/monitoring/rate-limit gates, and production rollout remain separate scopes.

## 3. Roles and working relationship

- Darshan owns product direction, priority, scope, risk decisions, and approvals.
- Codex / Sol owns careful execution, backend/cross-cutting work, verification,
  cleanup, and durable handoff state.
- Claude Code is the architecture/review/frontend counterpart. Its handoffs and
  audits are inputs, not substitutes for current source and live verification.
- Perplexity is used for deep research and Gemini for broad exploratory questions
  when Darshan asks.

The next Codex task should feel like the same operator continuing the job:
direct, evidence-based, careful with provider state, and unwilling to silently
widen scope. Do not make Darshan repeatedly explain the product, branch model,
or collaboration process.

## 4. Locked product and safety decisions

- Production `main` is not an editing branch. Do not push, merge, deploy,
  migrate, configure, smoke with mutations, rotate, alias, or delete anything in
  production without a new explicit production approval.
- Immutable production fallback tag: `pre-hardening-8c38909` at `8c38909`.
- Integration/staging branch: `codex/production-hardening-baseline`.
- New work branches from a freshly verified remote integration SHA and PRs only
  back to integration unless Darshan explicitly authorizes the final production
  gate.
- Preserve and exclude the user-owned untracked directories `designs/`,
  `designs_mobile/`, and `docs/bharatgrowth/design/`. Do not read, stage, clean,
  move, summarize, or edit them.
- Preserve and exclude the concurrent untracked
  `docs/bharatgrowth/CLAUDE_HANDOFF.md`. It belongs to Claude's separate task;
  report a real overlap but do not consume it as canonical Codex scope.
- Never print, paste, document, invent, or request secrets, environment values,
  OTPs, passwords, phone test fixtures, provider tokens, private keys, customer
  data, or private auth state.
- A user login/takeover gate is allowed only on a verified staging-only preview.
  Darshan enters private values himself and tells Codex when signed in.
- The raw-ten-digit staging phone workaround was temporary, preview-only, and
  removed. Do not commit it. Current UI visibly shows `+91`; committed
  `useAuth.sendOtp` sends `91XXXXXXXXXX` without a literal plus. Preserve that
  exact inherited behavior until separately approved Auth/provider work.
- Staging fixtures must be synthetic or explicitly approved, uniquely
  identifiable, minimal, and cleaned with readback verification.
- Do not claim a gate passed because code exists or because an older task said
  it passed. Record exact current evidence or explicitly reuse still-valid
  evidence when no relevant code/configuration changed.
- Stop rather than choosing a new route when an approved document conflicts
  with Darshan's current instruction or live state.

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

## 6. Exact verified post-Wave 7 checkpoint

This handoff-maintenance branch is documentation-only and starts from exact
remote integration `053abca608bfa9e3d95c847b8a9481c847c3a76f`. A later
documentation-only merge may advance the integration SHA; the application and
Supabase tree beneath it must remain identical to `053abca`.

### Git and workspace

- Repository: `darshan-Jahagirdar/bharat-growth`.
- Production `origin/main`:
  `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.
- Integration `origin/codex/production-hardening-baseline`:
  `053abca608bfa9e3d95c847b8a9481c847c3a76f`.
- Reviewed Wave 7 branch head:
  `6a1e38134c4854e3dba96d9bdddbe74298f65204`.
- Wave 7 implementation checkpoint before evidence docs: `672360f`.
- Wave 7 characterization rollback checkpoint: `c4623cc`.
- Whole-wave rollback/base: `a81a7d197a82ba48f741a6c05250fdcf8a6e3966`.
- The Wave 7 reviewed head and integration squash merge have identical trees.
- The local integration branch label may be stale. Never use it as a base
  without fetching and rechecking the remote pointer.
- At handoff preparation, the only untracked paths were the three excluded
  design directories and `docs/bharatgrowth/CLAUDE_HANDOFF.md`. They remained
  unread, unstaged, and untouched.

### GitHub

- PR [#10](https://github.com/darshan-Jahagirdar/bharat-growth/pull/10)
  (`codex/decompose-data-access` → integration) is merged.
- PR #10 reviewed head: `6a1e38134c4854e3dba96d9bdddbe74298f65204`.
- PR #10 squash merge: `053abca608bfa9e3d95c847b8a9481c847c3a76f`.
- PR #10 checks `quality`, `public-smoke`, Vercel, and Vercel Preview Comments
  completed successfully.
- Draft PR [#1](https://github.com/darshan-Jahagirdar/bharat-growth/pull/1)
  remains the guarded integration-to-`main` release vehicle. It is open, draft,
  mergeable, and points from exact integration `053abca` to unchanged `main`.
  Its current-head `quality`, `public-smoke`, Vercel, and preview-comment checks
  pass. It is not permission to merge or touch production.
- PRs #2–#10 are the completed foundation/decomposition/handoff history. Draft
  PR [#11](https://github.com/darshan-Jahagirdar/bharat-growth/pull/11) is the
  documentation-only post-Wave 7 handoff branch targeting integration. It
  opened at `5718822`; blocker record `533a1f1` then passed all four normal
  checks. This file's final documentation commit necessarily advances the PR,
  so re-derive its exact head/checks rather than treating either predecessor as
  current. Darshan explicitly granted the documentation-only preview waiver
  below. PR #11 may merge only into integration once its exact current head is
  mergeable and `quality`, `public-smoke`, Vercel, and Vercel Preview Comments
  all pass.

### Supabase

- Production project ref: `vyycczqhvsgkiqtxxxos`.
- Linked staging project ref: `qokaaggeqahayxsybgds`.
- A fresh `supabase migration list --linked` on 2026-07-18 returned continuous
  matching local and remote migrations 001–048.
- Migration 049 does not exist or apply yet. It remains a future reviewed
  contract migration after the Storefront/public-consumer audit.
- Migrations 013/014 still provide the temporary anonymous compatibility reads.
  Migration 042 added constrained public RPCs but intentionally did not remove
  those policies.
- The user-owned staging Auth test identity remains. Wave 7 created no Auth,
  profile, fixture, checkout, provider, schema, policy, or data mutation.
- Legacy exposed staging credentials had already been disabled/revoked. Never
  print key material. Remaining rotation is a pre-sale owner gate, not handoff
  or decomposition work.

### Vercel

- Exact post-Wave 7 integration deployment:
  `dpl_x8Q9n7bkokCVHK2tPYPnyGMpSFtZ`.
- Inspector:
  `https://vercel.com/darshan-jahagirdars-projects/bharat-growth/x8Q9n7bkokCVHK2tPYPnyGMpSFtZ`.
- State: `READY`; target: Preview (`target: null`); region: Mumbai (`bom1`).
- Deployment Git metadata: branch `codex/production-hardening-baseline`, exact
  commit `053abca608bfa9e3d95c847b8a9481c847c3a76f`.
- The verified post-merge scan loaded all eight login assets. Their combined
  bundle contained the staging project ref and active publishable-key shape,
  with no unexpected Supabase ref, legacy JWT key shape, or server-secret shape.
- The exact post-merge smoke-window error/warning/fatal runtime query returned
  no entries. A later seven-day query exceeded retained log history and is not
  replacement evidence; do not misreport it as a failure.
- Live 2026-07-18 environment readback found no variables scoped to
  `codex/decompose-data-access`. Integration retains exactly the three expected
  encrypted staging Preview variables under
  `codex/production-hardening-baseline`; no values were printed.
- No preview was promoted. No deployment, alias, obsolete retained preview, or
  retained branch setting was deleted.

### Documentation-only preview waiver — PR #11

- Exact predecessor deployment `dpl_6WZC5W16cVsu54pX4AyTYqijooXe` is `READY`,
  Preview-only (`target: null`), and exact branch/commit
  `codex/prepare-post-wave7-handoff` /
  `d1da6b81e1746ae354643638b589d09692acce66`. Earlier deployments
  `dpl_2rpPncpEuYU2LzTWMKrk4ep7oDCv` and
  `dpl_4jNQ2wEhyDuGVUqPZbm5GZEp1rAy` are also retained. This waiver commit
  creates another exact-head deployment; re-derive it.
- GitHub `quality`, `public-smoke`, Vercel, and Vercel Preview Comments passed
  on predecessor `d1da6b8`. These are valid docs-branch/build/route-health
  facts; they do not prove Supabase staging isolation. The waiver commit must
  pass the same four normal checks before merge.
- The branch currently has zero branch-scoped Vercel variables. Integration's
  three sensitive staging Preview entries could not be duplicated through the
  available safe CLI/API paths without either materializing a value or relying
  on the pre-existing ignored local environment. No environment value was
  displayed, logged, or inspected by Codex.
- One CLI path loaded the pre-existing ignored `.env.local`; filesystem metadata
  confirms it was not created or modified. A clean temporary link unexpectedly
  wrote an OIDC environment file; it was deleted unread with its entire exact
  temporary directory. A later FIFO attempt was terminated and cleaned. Three
  untrusted late-created branch entries were individually removed. Final
  readback shows zero branch variables, no copy process, and no temporary path.
- The generated deployment is intentionally retained because destructive
  deletion is prohibited, but it is not valid staging evidence. Do not open,
  smoke, promote, alias, or cite it as staging-wired.
- Darshan explicitly waived branch-scoped staging isolation for PR #11 only.
  The PR changes Markdown only, has zero `src/` and zero `supabase/` diff, has no
  behavior surface or authenticated smoke, and preserves the already-proven
  integration application tree at `053abca`. This is a user-approved docs-only
  waiver, not a staging-isolation result. Do not copy, decrypt, pipe, pull,
  materialize, or otherwise move an environment value for this merge.
- The waiver does not apply to a future application, browser, login, database,
  Auth/provider, migration, or production scope. PR #11 may leave draft and
  merge only into integration after its exact current head/base, mergeability,
  Markdown-only scope, and four normal checks are reverified.

### Automated and compatibility verification

- 24 exact query-shape characterization tests cover Billing, Orders, Dashboard,
  and Storefront facades.
- The final repository gate passed 140 tests across 28 files, strict TypeScript,
  repository-wide ESLint, the optimized 25-route build, and `git diff --check`.
- The first typecheck was accidentally concurrent with `next build` and only saw
  transient missing generated `.next/types`; the isolated rerun passed without
  a code change.
- All 32 consumers present at Wave 7 base `a81a7d1` have zero diff.
- Route, hook, component, TSX, CSS, Supabase, Auth, and provider files have zero
  Wave 7 diff.
- Branch credential, sensitive-value, and phone-shape scans passed.
- Per Darshan's explicit Wave 7 scope, no browser, screenshot, pixel, visual,
  login, OTP, or authenticated-UI gate was run. CI `public-smoke` is the route
  health evidence. Zero UI-source diff is preservation evidence, not a visual-
  equivalence claim.

### Collaboration artifacts

- Canonical Google handoff:
  [BharatGrowth handoff](https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit).
- Slack channel: `#bharatgrowth`, ID `C0BG39UE1A9`.
- Wave 7 preview-ready post:
  [Slack message](https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784217703821789).
- Wave 7 merged post:
  [Slack message](https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784218146352919).
- Exact Google/Slack update and readback rules live in
  `COLLABORATION_WORKFLOW.md`.

## 7. Completed foundation and decomposition waves

| Wave | Characterization rollback | Integration merge | Preserved result |
|---|---|---|---|
| 1 Billing/POS | Recorded in log | `e6b58e3` | Billing logic, controllers, focused views; keyboard/money/payload behavior preserved. |
| 2 Orders | `531ea11` | `1695da7` | Order controller/presentation/views; query facade held for Wave 7. |
| 3 Products | `49106b3` | `b38e0ad` | Product transforms, data/editor hooks, focused form/catalog views. |
| 4 Dashboard/progress | `74fc96b` | `ac75c68` | Dashboard transforms/hooks/views; query facade held for Wave 7. |
| 5 Purchases | `2e6bec8` | `907dfe3` | Purchase transforms/hooks/views; Purchase History unchanged. |
| 6 Storefront | `ac7fe57` | `6255234` | Modern transforms/hooks/views; all three themes and checkout behavior preserved. |
| 7 Data access | `c4623cc` | `053abca` | Query implementations split by use case behind stable compatibility facades. |

Wave 6's pixel comparison was explicitly waived by Darshan because an
intentional Storefront redesign is separate upcoming work. That is a waiver,
not a visual-equivalence result. Wave 7 had no UI-source changes and explicitly
used no browser/visual gate.

The complete commit, PR, preview, browser/visual-or-waiver, cleanup, and rollback
history is in `quality/DECOMPOSITION_LOG.md`.

## 8. Wave 7 ownership and compatibility result

The four original module paths remain the public compatibility boundary:

- `src/lib/billing/billingQueries.ts` — 21-line facade. Billing client, types,
  search, invoice/RPC, customer, and shop queries are in focused modules.
- `src/lib/orders/orderQueries.ts` — 24-line facade. Shared constants/types,
  fetches, and mutation/RPC operations are separated.
- `src/lib/dashboard/dashboardQueries.ts` — 21-line facade. Client, date ranges,
  KPI, analytics, retention, stock, GST, and orchestration are separated.
- `src/lib/storefront/queries.ts` — 7-line facade. Public shop/contact and
  catalog access are separated under the existing public-client boundary.

Compatibility tests pin exact `.select()` strings; `.eq()`, `.gt()`, `.gte()`,
`.lte()`, `.lt()`, `.in()`, and `.or()` filters and arguments; sort direction
and null behavior; limits/ranges; table, storage, and RPC names; full RPC and
mutation argument objects; client/table/call sequence; warnings/errors;
fallbacks; and result shaping. Tests that only compare returned rows are not a
valid substitute for this query-shape contract.

Billing and Dashboard preserve their authenticated singleton clients. Orders
preserves per-operation authenticated client creation. Storefront preserves
per-operation public client creation. No migration, RLS, query boundary,
payload, or consumer changed.

## 9. Preserved post-decomposition candidates

These were deliberately logged, not fixed:

- Dashboard ranges mix IST starts with a UTC retention end; default KPI reads
  omit an upper bound and current-month GST ends at the current IST day.
- Top-product status, low-stock activity, and negative-stock tracking filters
  remain application-side.
- Consider a composite `inventory (shop_id, quantity_in_stock)` index and
  trigram/functional Billing search indexes only after staging query-plan proof.
- Dashboard preserves a fixed fan-out of eleven table reads plus one retention
  RPC; no per-row N+1 was found. Profile before consolidation.
- Orders preserves `hasMore = rows.length === 50`, including its full-page
  ambiguity.

Any fix requires a separate characterization and behavior-changing PR. Do not
fold these into migration 049, a redesign, or unrelated Auth/payment work.

## 10. Exact next-gate options

Do not begin one merely because it is listed. Darshan must select the scope.

### A. Storefront public-consumer audit and migration 049 staging gate

This is the next approved production-hardening sequence after decomposition:

1. Characterize every public Receipt and Storefront consumer and the exact
   anonymous fields/calls it uses.
2. Prove the browser Storefront loader can use the constrained path without
   changing themes, Modern cart/checkout, stock, contact, errors, payloads, or
   visual output.
3. Implement the separately reviewed application hardening change before
   removing compatibility access.
4. Write migration 049 only after the consumer proof. Review policies, grants,
   functions, `search_path`, ownership, security-definer/stability, and public
   shapes.
5. Dry-run and apply only to linked staging, then run the required database and
   public application cases. Production remains untouched.

Migration 049 is not authorized by this handoff alone.

### B. Intentional Storefront/frontend redesign

This is separate product/design work, owned with Darshan and Claude's frontend
review. Read but do not touch the protected design directories unless Darshan
explicitly changes their ownership/scope. Establish new visual/behavior
contracts; do not treat the Wave 6 visual waiver as a design baseline result.

### C. Auth/provider, payment, or other product work

Auth normalization/provider design, Razorpay/payment subscriptions, discount
UX, loyalty redemption, server-authoritative POS totals, offline/bilingual/
e-invoicing work, and DPDP operations each require their own approved scope and
contracts. Preserve the current `+91`/`91XXXXXXXXXX` behavior until the Auth
scope explicitly replaces it.

### D. Sale-readiness and final rollout preparation

Complete the full manual regression matrix, approved real staging AI scan,
Meta/template/webhook configuration, monitoring test event, rate limiting,
credential rotation, and production identity gate. The approved brief allows a
single staged-then-production rollout because there are no real users, but only
after all gates and a fresh explicit Darshan production approval.

## 11. Verification and communication discipline

- Repository/current source and GitHub are execution truth. Google Drive is the
  human-readable continuity mirror. Slack is the concise milestone feed.
- Update the exact existing Google handoff after a characterization checkpoint,
  verified PR/preview gate, genuine blocker, and actual integration merge.
- Post to `#bharatgrowth` only for blockers, preview-ready/ready-to-merge, and
  merged milestones. Sign Codex-authored posts `— Sol/Codex`.
- Include exact commits, PR/deployment links, verification, production-safety
  status, and next action. Never include secrets, OTPs, private fixtures,
  environment values, or customer data.
- Before a check, review the verification log and state what new evidence it
  provides. Skip checks that would only duplicate valid evidence.
- Rerun a check only when relevant code/configuration changed, a new deployment
  must be verified, an earlier result failed/became invalid, or a final gate
  explicitly requires a fresh result.
- Browser work is for otherwise-unprovable interaction, focus/keyboard,
  authenticated staging, or visual evidence. Do not open a browser merely to
  repeat route health or a data-access fact already covered by CI/source.
- Reuse the same exact deployment and authenticated session when safe. Darshan
  performs every private login/OTP step.
- Use branch-scoped staging previews only. Never promote or touch production.
- An obsolete misconfigured documentation preview and its temporary branch
  settings were intentionally retained because destructive deletion was
  prohibited. Do not delete or rotate retained resources without fresh
  approval.

## 12. Known stop conditions

Stop before source or external writes if any of the following is true:

- a required file was not read completely;
- remote integration/main, PR state, staging project/migrations, or deployment
  commit/state contradicts this handoff;
- a docs-only merge changed `src/` or `supabase/`, or the application tree differs
  from `053abca` for unexplained reasons;
- the working tree contains anything besides intended branch changes, the three
  preserved design directories, and the known concurrent untracked
  `docs/bharatgrowth/CLAUDE_HANDOFF.md`;
- a concurrent Claude task overlaps the same tracked file or changes the remote
  integration base;
- preview isolation required by the active scope cannot prove staging-only use
  and has not been explicitly waived for a documentation-only PR;
- migration history drifts, migration 049 already exists unexpectedly, or the
  linked target is not staging `qokaaggeqahayxsybgds`;
- a proposed change alters a preserved behavior/query/client/payload/RLS/
  provider boundary without its own approval and characterization;
- a credential, OTP, private fixture, or production action would have to be
  exposed or guessed;
- any gate fails or cleanup cannot be proven.

## 13. Exact first prompt for the next Codex task

Use this continuation prompt after opening a fresh task:

> Continue BharatGrowth from the verified post-Wave 7 handoff. First read
> `/Users/darshan_j/BharatGrowth/docs/bharatgrowth/CODEX_HANDOFF.md` completely,
> then every file in its Required reading order. Do not trust remembered or
> compacted state. Re-derive local Git status/log/branch, remote `main` and
> `codex/production-hardening-baseline`, GitHub PR/check state, the linked
> staging Supabase project and migration list, and the latest exact-commit
> integration Vercel deployment. Stop and report before changes if anything
> contradicts the handoff or a concurrent Claude task overlaps the scope.
>
> Confirm all seven decomposition waves are merged only into integration at the
> live successor of `053abca608bfa9e3d95c847b8a9481c847c3a76f`, production
> `main` remains `8c389098db7e31180b5bdd6f1661adfd4bdc902b`, PR #10 is merged,
> staging remains `qokaaggeqahayxsybgds` with migrations 001–048 matching, and
> the application/Supabase tree beneath any later documentation-only merge is
> identical to the Wave 7 integration checkpoint `053abca`. Confirm the exact
> integration preview is READY, Preview-only, staging-wired, and that temporary
> `codex/decompose-data-access` variables remain absent.
>
> Re-derive PR #11 and its documentation-only preview waiver. Exact predecessor
> `d1da6b8` passed all checks with READY/Preview-only deployment
> `dpl_6WZC5W16cVsu54pX4AyTYqijooXe`; the waiver commit and merge necessarily
> advance the relevant pointers. Final cleanup left zero branch-scoped
> variables and no temporary process/path. No value was displayed, logged, or
> inspected; an unexpected temporary OIDC file was deleted unread. No PR #11
> deployment is staging evidence. Darshan explicitly waived staging isolation
> for this Markdown-only PR because it has zero `src/`/`supabase/` diff and no
> behavior or authenticated-smoke surface. Do not copy or materialize a value.
> If PR #11 is not yet merged, it may merge only into integration after exact-
> head `quality`, `public-smoke`, Vercel, and Vercel Preview Comments pass and
> GitHub reports it mergeable. If already merged, verify the live integration
> successor and unchanged production `main`.
>
> Treat `FEATURE_AND_BEHAVIOR_INVENTORY.md` as the product-preservation
> contract. Preserve the Wave 7 compatibility facades and exact query-shape
> characterization. Do not opportunistically fix the logged IST/filter/index/
> fan-out/pagination candidates. Preserve the Auth contract: the UI shows `+91`
> while committed `useAuth.sendOtp` sends `91XXXXXXXXXX` without a literal plus.
> Never print/request/invent secrets, OTPs, private phone fixtures, environment
> values, or customer data. Preserve, exclude, and do not read `designs/`,
> `designs_mobile/`, `docs/bharatgrowth/design/`, or
> `docs/bharatgrowth/CLAUDE_HANDOFF.md` unless Darshan explicitly changes scope.
>
> Ask Darshan to confirm the next approved workstream if it is not already
> explicit. Migration 049/public-boundary hardening, the intentional Storefront
> redesign, Auth/provider work, payments, sale-readiness, and production are
> separate scopes. Migration 049 must begin with a live public-consumer audit
> and staging-only application compatibility proof; it is not authorized by the
> handoff itself. Never merge or deploy to production.
>
> Follow `COLLABORATION_WORKFLOW.md`: repository/GitHub are execution truth;
> update the canonical Google handoff at real milestones; post only blocker,
> preview-ready/ready-to-merge, and merged milestones to `#bharatgrowth` signed
> `— Sol/Codex`; use branch-scoped staging previews; and clean only temporary
> resources created in scope. Before every check, state what new evidence it
> provides. Do not repeat valid automated, browser, visual, login, staging, or
> deployment evidence unless code/config changed, a new deployment requires it,
> an earlier result failed/became invalid, or the final gate explicitly requires
> a fresh result.
