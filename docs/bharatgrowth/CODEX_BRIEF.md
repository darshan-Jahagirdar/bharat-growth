# Brief for Codex — Context Reset & Process Update

**From:** Darshan (via Claude, acting reviewer) · **Date:** 2026-07-12
**Applies to:** the production-hardening / decomposition work on `codex/production-hardening-baseline`

---

## TL;DR — your exact next actions, in order (do not deviate)

1. Re-ground your context (Section 1 below). Log it in `DECOMPOSITION_LOG.md`.
2. Commit or discard the two dirty doc files.
3. Open the draft baseline PR as already planned.
4. Run the seven decomposition waves **exactly as written in `DECOMPOSITION_PLAN.md` — unchanged**.
5. Then, and only then: write contract migration 049 → apply on staging → verify anon
   boundary → apply 036–049 to production together with the app deploy in ONE rollout
   (no compatibility window — there are no users to protect).
6. During the production step: delete `dev@bharatgrowth.in` from production `auth.users`.

**What this brief does NOT change:** the decomposition plan, the wave order and scope,
behavior-preservation rules, staging-first discipline, PR/CI discipline, or any safety
gate. It ONLY (a) removes the gradual/backwards-compatible rollout requirement and
(b) adds the process items in Section 5.

**If anything in this brief appears to conflict with the plan docs, do not pick a new
route on your own — stop and ask Darshan.**

---

## 1. You have compacted context twice — re-ground before continuing

Do not trust remembered state. Before your next action, rebuild your working
context from disk and remote, in this order:

1. Re-read `docs/bharatgrowth/README.md`, `DECOMPOSITION_PLAN.md`, `DECOMPOSITION_LOG.md`,
   `MIGRATION_RUNBOOK.md`, `quality/BUG_FIX_PLAN.md`, and this brief.
2. Re-derive actual repo state: `git log --oneline -10`, `git status`, current branch,
   what is committed vs dirty (two docs files were left uncommitted at last review).
3. Re-verify staging state directly: `supabase migration list` (expected: 001–048 applied),
   not from memory.
4. Write a short "context re-established" entry in `DECOMPOSITION_LOG.md` stating where
   you believe you are in the plan and what the next wave is — *then* resume.

If anything on disk contradicts what you remember, the disk wins.

## 2. Critical context correction: there are NO real users

The "production" Supabase project and Vercel deployment contain **only Darshan's test
shops and test customers**. The app is pre-launch. This changes your plan:

- **Security findings are pre-launch gates, not live incidents.** No real PII was ever
  exposed. Urgency framing changes; the fixes themselves stay.
- **Drop the zero-downtime choreography.** Expand/contract with a compatibility window
  protects live traffic that does not exist. Simplify: after staging validation, apply
  migrations 036–048 + the contract migration (049) to production and deploy the app in
  **one staged-then-prod rollout**. Keep staging-first discipline (it caught two real
  bugs — keep it), but do not spend effort on gradual/backwards-compatible rollout.
- **Delete-and-reseed is acceptable** for test data if it simplifies anything.
- The GSTIN stored-data migration check from Claude's review is now moot (test customers
  only). Optional nice-to-have: mirror the checksum in the POS inline GSTIN field.

## 3. Outstanding items from Claude's review (approved with flags)

- **Delete `dev@bharatgrowth.in` from PRODUCTION `auth.users`** (and its `public.users`
  row). Neutralizing migration 011 in the repo did not remove the already-created DB
  user, and `devpass123` is in git history permanently. Add this to the runbook as a
  pre-launch hard gate.
- Commit or discard the two dirty docs files (`DEPLOYMENT_AND_ROLLBACK.md`,
  `DECOMPOSITION_LOG.md`).
- Everything else in the baseline was verified independently by Claude (33 tests,
  tsc/lint/build, GSTIN algorithm vs 4 real GSTINs, staging ledger, migrations
  042–048 read line-by-line) and is approved.

## 4. Roadmap after the codebase check (do NOT scope-creep into it)

Once decomposition + prod rollout are done and verified, Darshan's sequence is:
1. **Discount mechanism** — engine already exists in `calculateTotals`/billing store;
   needs UI wiring + clamps (no negative discounts; invoice discount ≤ total).
2. **Razorpay payment gateway** — API keys already exist; they must live in env vars
   only, never in the repo or docs.
3. **Frontend overhaul** — assigned to Claude, later. Your decomposition PRs
   (splitting the large pages) directly enable this; keep them behavior-preserving,
   no feature or visual changes inside decomposition PRs.

## 5. Process requirements going forward

- **Google Drive:** maintain the canonical collaboration docs in the shared Drive
  folder (where `PROJECT_HANDOFF.md` / `AGENTS.md` live). After each milestone, update
  the Drive copy of the handoff/status doc so Darshan and Claude can read state without
  opening the repo.
- **Slack:** post progress updates to the BharatGrowth workspace (use `#bharatgrowth`
  if it exists, else `#general`) at real milestones — baseline PR opened, each
  decomposition wave merged, staging/production migration events — not only one final
  message. Each update: what changed, PR link, verification evidence, blockers.
  Never post success if any gate failed.
- **GitHub:** keep the existing discipline — small independently revertible PRs, CI
  green before merge, no direct pushes to `main`, decomposition-log entry per PR.

— End of brief. Acknowledge by logging a context-re-established entry in
`DECOMPOSITION_LOG.md` and posting your first Slack status update.

## Decision addendum — 2026-07-12

Darshan approved `codex/production-hardening-baseline` as the integration/staging
branch. Each decomposition wave merges through its own PR into that branch and
is staging-smoked before the next wave. Production `main` remains unchanged
until all seven waves and approved launch features pass staging, followed by the
single controlled pre-launch production rollout.

## Status addendum — 2026-07-15

This brief remains the approved decision record, but its “next actions” and
33-test baseline are historical checkpoints, not the current stage. Do not redo
completed setup actions.

- At this historical checkpoint, Waves 1–5 were merged only into integration;
  application checkpoint was `907dfe3`, and Wave 6 Storefront was next. The
  later completion addendum below is current.
- At that checkpoint, the suite was 94 tests across 19 files, with strict
  typecheck,
  zero-warning lint, 25-route build, GitHub checks, staging browser/visual gates,
  and cleanup evidence passing through Wave 5.
- Production remains `8c38909` and untouched.
- The exact existing Google handoff and `#bharatgrowth` channel are now resolved.
  Use [`COLLABORATION_WORKFLOW.md`](COLLABORATION_WORKFLOW.md); do not fall back to
  `#general` or search for a second handoff.
- Product/behavior truth is now mapped in
  [`product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](product/FEATURE_AND_BEHAVIOR_INVENTORY.md).
- The approved one-rollout production decision still applies only after all
  decomposition, migration 049 staging, sale-readiness, and explicit production
  gates. It is not current authorization.
- Migration 049 must be preceded by a live-consumer audit: migration 042 is
  additive, and the current browser Storefront loader still uses the legacy
  anonymous compatibility policies. Do not remove them until a separate
  reviewed application hardening change proves the constrained path preserves
  Storefront behavior.

## Wave 6 completion addendum — 2026-07-15

- Wave 6 Storefront is merged only into integration at `6255234`; its final
  application-source checkpoint is `145437b`. Production remains `8c38909` and
  untouched.
- The current suite is 116 tests across 24 files, with strict typecheck,
  zero-warning lint, the optimized 25-route build, GitHub checks, staging theme
  smoke, runtime inspection, and cleanup evidence complete.
- Wave 7 data access is now the final decomposition wave. It must preserve the
  exact exports, client trust boundaries, SQL selections, filters, ordering,
  pagination, RPC arguments, error mapping, result shaping, and call sequencing
  of the Billing, Orders, Dashboard, and Storefront query facades.
- The intentional Storefront redesign remains separate product work after Wave
  7. Migration 049 remains a later, separately reviewed staging contract gate.

## Wave 7 completion addendum — 2026-07-18

- All seven decomposition waves are complete and merged only into integration
  at `053abca608bfa9e3d95c847b8a9481c847c3a76f`. Production remains
  `8c389098db7e31180b5bdd6f1661adfd4bdc902b` and untouched.
- Wave 7 retained the original Billing, Orders, Dashboard, and Storefront query
  module paths as compatibility facades while splitting implementation by
  cohesive use case. Twenty-four tests pin exact query shape and all 32 base
  consumers have zero diff.
- The current verified suite is 140 tests across 28 files, with strict
  typecheck, zero-warning lint, optimized 25-route build, GitHub checks, exact-
  head staging isolation/runtime evidence, and branch-variable cleanup complete.
- Per Darshan's Wave 7 scope, no browser, screenshot, pixel, visual, login, OTP,
  or authenticated-UI gate was run; CI `public-smoke` and zero UI-source diff
  are the approved evidence, not a visual-equivalence claim.
- The next task requires a fresh explicit scope. The approved next hardening
  sequence is Storefront/public-consumer audit, behavior-preserving constrained-
  path application work, and only then migration 049 on staging. The redesign,
  Auth/provider, payment, sale-readiness, and production gates remain separate.
