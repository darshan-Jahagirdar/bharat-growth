# Deployment and Rollback

Last reconciled: 2026-07-15. This runbook separates decomposition previews from
the later explicitly approved production rollout.

## Branch flow

- `main` is production and is never an editing branch.
- `codex/production-hardening-baseline` is the integration/staging branch and
  remains the head of draft PR #1 to `main`.
- Each decomposition wave uses a short-lived `codex/decompose-*` branch and a PR
  targeting only integration.
- Documentation/handoff changes use a separate `codex/*` branch and PR into
  integration.
- Vercel Git integration creates previews. Direct `vercel --prod`, promotion,
  production alias changes, and production environment changes are prohibited
  during decomposition.

Always re-derive the remote branch pointers. A local integration pointer may be
stale, and a docs-only merge may advance integration without changing the
application tree.

## Per-PR preview gate

1. Confirm intended diff scope and excluded user-owned design directories.
2. Push the exact reviewed branch and open a draft PR to integration.
3. Verify GitHub base/head branch and exact head SHA.
4. Confirm `quality`, `public-smoke`, Vercel, and preview-comment checks pass.
5. Confirm Vercel deployment metadata matches the exact branch/SHA.
6. Confirm Preview variables are branch-scoped to staging; public bundles must
   contain staging Supabase ref and no production ref.
7. Run focused public/protected browser, API, and bounded database checks with
   synthetic data. Provider or data mutations require their own explicit scope.
8. Compare integration versus feature using the same browser, fixture, route,
   viewport, data, and UI state.
9. Inspect build/runtime errors for the smoke window.
10. Remove temporary profiles, fixtures, sessions, branch variables, workaround
    previews, screenshots/helpers, and other evidence artifacts; verify cleanup.
11. Update repository docs, the exact Google handoff, and `#bharatgrowth` with
    facts, not predicted success.
12. Merge only into integration and verify its new remote SHA and post-merge
    preview.

## Latest verified integration evidence

- Integration merge / Wave 6 application checkpoint:
  `6255234937a79b2d74d2a3a577a8065d167d911f` / `145437b13eeff1d1cd4f7eebfe86d06611805dfb`.
- PR [#8](https://github.com/darshan-Jahagirdar/bharat-growth/pull/8)
  merged only into integration with all required checks successful.
- Vercel integration deployment: `dpl_3cu9JfBqjAgB929LQbmvAC2bEmmh`, READY and
  Preview-only for exact integration branch/commit `6255234`, Mumbai region.
- Linked Supabase target: staging `qokaaggeqahayxsybgds`, migrations 001–048
  matching.
- 116 tests/24 files, strict typecheck, zero-warning lint, and 25-route build.
- Error/warning/fatal runtime-log query returned no entries for the verified
  post-merge deployment.
- Production `main` remains `8c38909`; no production app, database, Auth,
  environment, alias, or data changed.

A docs-only Wave 7 handoff PR may move the integration head. Re-derive it and
confirm `src/` and `supabase/` remain identical to application checkpoint
`145437b` before Wave 7.

## Staging authentication gate

When Darshan must sign in, give him only the exact staging-only preview URL and
instructions. Do not ask him to paste the phone, email, OTP, password, or secret
into chat. Take over the authenticated browser only after he says it is ready,
then sign out and clean only temporary state created in scope.

Vercel sessions are hostname scoped. Avoid extra temporary preview hostnames
because they can force another login even for the same Supabase account.

## Final production gate

Production work begins only after Waves 6–7, migration 049 staging proof, full
sale-readiness regression, external provider/monitoring gates, and a new
explicit Darshan approval.

The approved brief specifies one controlled staged-then-production rollout,
because there are no real users, instead of a long compatibility window:

1. Verify the exact production app/DB/project/alias targets and reviewed commit.
2. Verify and remove the known development Auth/public membership at the
   production identity gate without guessing identifiers.
3. Review the exact production migration dry run; live history decides the
   range, though the brief expects 036–049.
4. Apply the reviewed migrations and exact app release as the single controlled
   rollout.
5. Confirm production deployment READY, aliases, Auth cleanup, migration
   history, core public/protected flows, transactions, logs, monitoring, and
   provider state.
6. Create release evidence/tag and update repository/Google/Slack only after
   success.

This is a future runbook, not current authorization.

## Rollback

- Code: promote/redeploy the recorded last-known-good production deployment or
  merge a reviewed revert, according to the live incident plan.
- Database: keep compatible additive changes where possible; restore restrictive
  grants only through a reviewed forward recovery migration.
- Messaging: stop campaign/cron/provider execution if dependencies are
  unhealthy.
- Data: do not use destructive cleanup against unidentified production rows.
- Communication: do not send the final Slack success message until recovery is
  complete and all required gates pass.

Environment-variable names may be documented; values remain in Vercel,
Supabase, Meta, or the owner's password manager.
