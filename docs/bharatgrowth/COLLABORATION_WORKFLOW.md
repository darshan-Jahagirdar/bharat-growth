# BharatGrowth Collaboration Workflow

Last verified: 2026-07-18 (Asia/Kolkata).

This file explains how the repository, GitHub, Google Drive, Slack, Supabase,
and Vercel are used together. It is an operating contract, not a suggestion to
create new channels, documents, projects, users, deployments, or credentials.

## 1. Roles and continuity

- **Darshan:** product owner. Sets product direction, priorities, locked scope,
  risk tolerance, and approvals.
- **Codex / Sol:** execution owner. Re-derives state, implements backend and
  cross-cutting work, runs gates, contains staging test data, keeps the durable
  handoff current, and reports exact evidence.
- **Claude Code:** architecture/review/frontend counterpart. Its historical
  audits remain inputs; current source and canonical docs decide truth.
- **Perplexity:** deep external research when requested.
- **Gemini:** broad exploratory questions when requested.

A new Codex task should feel like the same careful operator continuing the same
job. It must read the required handoff files, re-derive drift-prone state, and
continue from the documented gate. It must not restart the roadmap, reinterpret
product intent, or turn a decomposition into a redesign.

## 2. Source-of-truth order

Use this order when records disagree:

1. Darshan's current explicit instruction and approval boundaries.
2. Current source, migrations, automated tests, and live read-only verification.
3. `docs/bharatgrowth/CODEX_HANDOFF.md` and the canonical engineering docs.
4. GitHub PR/check history and exact remote commit pointers.
5. The shared Google handoff document.
6. Slack milestone posts.
7. Historical root docs, audits, old previews, or remembered task context.

If a drift-prone fact contradicts the handoff, stop and report it before changing
code, data, provider configuration, or docs.

## 3. Repository and GitHub workflow

### Branches

- `main` is production. Never develop on it, push to it directly, or merge into
  it during decomposition.
- `codex/production-hardening-baseline` is the integration/staging branch and the
  only base for decomposition waves.
- Each wave uses one short-lived `codex/decompose-*` branch created from the
  verified remote integration commit.
- Documentation/handoff maintenance uses its own `codex/*` branch and PR to the
  integration branch.

The local integration pointer may be stale. Always compare `origin/...` and a
fresh `git ls-remote`; never infer the base from an old local branch label.

### PR lifecycle

1. Verify clean scope and preserve the excluded design directories.
2. Characterize current behavior before application extraction.
3. Commit the wave-specific checkpoints. Waves 1–6 used pure transforms,
   controllers/hooks, then focused views; Wave 7 uses exact data-access
   characterization, use-case splits, compatibility facades, then
   verification/docs.
4. Push and open a draft PR targeting only the integration branch.
5. Verify the PR head SHA and base branch through GitHub.
6. Wait for `quality`, `public-smoke`, Vercel, and preview-comment checks.
7. Prove preview isolation, the wave-specific browser and visual-or-zero-UI-diff
   gate, cleanup, and documentation before marking ready.
8. Merge only after every per-wave gate passes. Re-verify the remote integration
   SHA and its post-merge preview.

PR descriptions record what changed, why, preserved behavior, tests, staging
scope, cleanup, production result, rollback points, and known follow-ups. A
green check is necessary but not a substitute for the branch-scoped browser and
visual gates.

## 4. Google Drive workflow

### Purpose and target

The repository is the canonical engineering record. Google Drive is the shared,
human-readable continuity mirror used so Darshan and other agents can understand
the latest milestone without reconstructing Git history.

Use this exact existing document unless Darshan explicitly replaces it:

- [BharatGrowth shared handoff](https://docs.google.com/document/d/1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I/edit)
- Document ID: `1pbhmmfvz_RLfqwbcTNkn5BZEJYfeSZzX4iOvf2DLu9I`

Do not create a second “current” handoff. Do not treat Google Drive as a place
for credentials, OTPs, private keys, environment values, customer data, or raw
provider logs.

### How we update it

1. Finish and verify the local milestone facts first.
2. Resolve the exact document through the Google Docs connector and read its
   current structure, revision, and tab identity.
3. Re-confirm the target document ID and intended section immediately before
   each write.
4. Use the smallest native Docs update that matches the existing heading/list
   structure. Use revision control when the write is based on a fresh revision.
5. Record exact branches, commits, PR links, staging project/deployment IDs,
   gates, cleanup, production result, blockers, and next step. Never paste a
   secret or sensitive fixture.
6. Read the edited document back through the connector. The milestone is not
   complete until the intended document contains the intended text.
7. After an actual merge, update the document again with the real merge commit
   and post-merge verification; do not leave “pending merge” as the final truth.

The Drive handoff is updated after real milestones: characterization checkpoint,
verified PR/preview gate, actual integration merge, or a genuine blocker. It is
not updated with speculative success.

## 5. Slack workflow

### Purpose and target

Slack is the concise milestone and coordination feed, not the canonical design
or engineering record.

- Channel: `#bharatgrowth`
- Channel ID: `C0BG39UE1A9`
- Last verified Wave 7 merge post:
  [Slack message](https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784218146352919)

Use the existing channel. Do not create another project channel, fan updates
into DMs, or add `@channel`, `@here`, or other broad mentions unless Darshan
explicitly asks.

### What a milestone post contains

Keep it short and evidence-based:

- what changed and why;
- branch, PR, and exact commit/merge commit;
- automated checks and focused characterization count;
- staging Supabase/Vercel isolation result;
- browser and visual result;
- cleanup and production result;
- blocker or exact next gate;
- link to the shared Google handoff when useful.

Do not post “complete,” “safe,” or “merged” before the corresponding gate is
true. If a gate fails, post the blocker/result honestly instead of a success
message. A preview-only action must say preview/staging; it must never sound like
a production release.

Before sending, re-read the channel or relevant thread when destination context
could be stale, resolve the exact channel ID, format links and code clearly, and
send one normal channel message unless a thread reply is explicitly intended.

## 6. Supabase workflow

- Production project ref: `vyycczqhvsgkiqtxxxos`.
- Linked decomposition/staging project ref: `qokaaggeqahayxsybgds`.
- Re-read the CLI-linked project marker and run `supabase migration list
  --linked` before a database-dependent wave.
- Stop if the linked target is production during staging work or if local/remote
  migration history drifts.
- Use only synthetic or explicitly approved staging fixtures.
- Never print tokens, passwords, service-role/secret keys, OTPs, or environment
  values.
- Record every temporary Auth/profile/data mutation, minimize it, and verify
  cleanup. Do not delete a user-owned test Auth identity without explicit scope.
- No schema, migration, RLS, grant, policy, function, or provider-setting change
  belongs inside a decomposition PR.

## 7. Vercel workflow

- Use Vercel Git previews, not direct production deployment commands.
- Match a preview to the exact expected Git commit through deployment metadata.
- Branch-scope staging Supabase variables; verify the public bundle contains the
  staging project ref and not the production ref.
- Keep server-only values server-only and never print them.
- Verify build state, protected/public routes, browser console, and error-level
  runtime logs for the smoke window.
- Delete temporary workaround previews and temporary branch variables after
  their evidence is captured. Retain the normal Git preview required by the PR.
- Do not promote, alias to production, use `--prod`, or change production
  environment variables during decomposition.

## 8. Staging authentication and takeover

When an authenticated browser gate needs Darshan:

1. Codex prepares the exact branch-scoped staging preview and validates it is
   staging-only.
2. Codex gives Darshan the exact preview URL and explains what must be entered,
   without requesting the phone number, email, OTP, password, or test secret in
   chat.
3. Darshan signs in and says when complete.
4. Codex takes over the already-authenticated preview for bounded smoke testing.
5. Codex signs out and removes only temporary profiles/data/previews it created.

Vercel sessions are hostname/origin scoped. A second temporary preview hostname
can require another login even when the underlying Supabase account is the same;
this is not an account reset. Avoid creating extra login-required previews.

The hosted staging test phone currently exposes a formatting mismatch with the
committed Auth request. The UI shows `+91`, while `useAuth.sendOtp` sends
`91XXXXXXXXXX` without a literal plus. The one-time workaround sent only the
raw ten digits; it was preview-only and removed. Do not reintroduce it into
source during decomposition; auth/provider design is a separate approved
workstream.

## 9. End-to-end milestone sequence

For each future approved implementation or hardening branch:

1. Read the handoff and required docs completely.
2. Re-derive local/remote Git, GitHub, Supabase, and Vercel state.
3. Stop on contradiction.
4. Create the wave branch from exact remote integration.
5. Characterize behavior; record rollback checkpoint.
6. Follow the selected scope's documented implementation order. Preserve the
   completed decomposition and Wave 7 compatibility/query-shape contracts.
7. Run focused and full automated gates.
8. Push draft PR; verify GitHub and branch-scoped preview.
9. Run only the bounded staging browser/API/database and visual-or-zero-UI-diff
   checks required by the current wave contract.
10. Clean every temporary fixture, session, variable, deployment, and local
    artifact; verify cleanup.
11. Update repository docs and the shared Google handoff with verified facts.
12. Post the evidence-based Slack milestone.
13. Merge only into integration, then verify remote head and integration preview.
14. Update Google/Slack with the actual merge state if the pre-merge update did
    not already include it.

Production is a separate, explicit, final controlled rollout after all waves and
sale-readiness gates. Nothing in this workflow implicitly authorizes it.

## 10. Stop conditions

Stop and report before acting if:

- the handoff conflicts with disk or a live service;
- remote integration or production pointers moved unexpectedly;
- a PR targets `main` or a wave starts from the wrong base;
- a preview resolves to production Supabase or its isolation cannot be proven;
- migration history drifts or the linked project is not the intended staging
  project;
- a behavior, payload, visual, copy, focus, keyboard, stock, RLS, consent, or
  workflow change appears in a decomposition;
- required authentication/authorization cannot be obtained without requesting
  or exposing a secret;
- temporary staging data cannot be identified or safely cleaned;
- any production action would be required without Darshan's new explicit
  approval.
