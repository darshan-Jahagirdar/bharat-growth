# Deployment and Rollback

## Branch flow

- `main` is production and is never an editing branch.
- `codex/production-hardening-baseline` is the integration/staging branch and
  remains the head of the final PR to `main`.
- Each decomposition wave uses a short-lived `codex/decompose-*` branch and a
  reviewed PR targeting the integration branch.
- GitHub CI must pass before merge.
- Vercel Git integration creates branch previews; direct `vercel --prod` is not
  the normal release path.

## Preview gate

1. Push the reviewed branch and open a draft PR.
2. Confirm the preview is built from the expected commit.
3. Confirm preview variables point to staging, never production.
4. Run browser, API, and database smoke tests.
5. Inspect build/runtime errors before approving the PR.

### Current baseline preview evidence — 2026-07-12

- Draft PR: [#1](https://github.com/darshan-Jahagirdar/bharat-growth/pull/1)
- Verified commit: `eb28f6d6ccc0af74ea688f819f85488695bc3292`
- Vercel deployment: `dpl_5L6bJqEB2aHQaifK1KE8WoAQHyqT` (`READY`)
- Supabase target: staging `qokaaggeqahayxsybgds`
- Public bundle scan: staging ref present; production ref absent.
- Login page: expected controls rendered with no Next.js error overlay.
- GitHub checks: `quality` and `public-smoke` passed.
- Runtime logs: no error or fatal entries for the verified deployment.

## Production gate

1. Apply compatible database expansion first and verify it.
2. Merge the exact reviewed commit to `main`.
3. Confirm the production deployment is `READY` and aliases resolve correctly.
4. Run bounded production smoke tests and inspect errors.
5. Apply the contract migration only after the new application is healthy.
6. Create the release tag and update the engineering record.

## Rollback

- Code: promote/redeploy the recorded last-known-good Vercel deployment or revert
  the merge commit.
- Database: keep additive changes; restore restrictive grants only through a
  reviewed forward recovery migration.
- Stop campaign/cron execution if its dependencies are unhealthy.
- Do not send the final Slack success message until recovery is complete and all
  required gates pass.

Environment-variable names may be documented; values must remain in Vercel,
Supabase, Meta, or the owner's password manager.
