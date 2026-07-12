# Decomposition Log

## Baseline preservation — 2026-07-11

- Production fallback: `pre-hardening-8c38909` at `8c38909`.
- Local intended-work checkpoint: `4b7424a`.
- Working branch: `codex/production-hardening-baseline`.
- Excluded local file: `.claude/settings.local.json`.
- Secret scan: only placeholder environment-variable names detected in
  `.env.example`; no credential value intentionally staged.
- Baseline size: 24,132 frontend lines; 7,938 Supabase SQL lines.
- Remote publish: checkpoint and verified baseline commits pushed to draft PR
  [#1](https://github.com/darshan-Jahagirdar/bharat-growth/pull/1).
- Supabase staging: dedicated project `qokaaggeqahayxsybgds` created and linked;
  production project `vyycczqhvsgkiqtxxxos` was never linked or modified.
- Local E2E uses installed system Chrome while CI installs pinned Chromium on
  the GitHub runner.
- Automated baseline: 33 tests across 7 files pass; strict typecheck, ESLint, and
  the Next.js production build pass. The build generated all 25 routes.
- Security baseline: committed development credentials removed, migration 011
  neutralized, GSTIN checksum validation added, and Anthropic vision model moved
  to the officially documented `claude-sonnet-5` identifier.
- Staging migration attempt found a fresh-install ordering defect before any
  ledger entry was written: migration 001 referenced `public.users`, created in
  migration 002. The helper definition was moved after the table creation and a
  regression test was added.
- Migrations 001-046 then applied successfully to the dedicated staging project
  `qokaaggeqahayxsybgds`; the local and remote migration ledgers matched exactly.
- Linked-schema lint reported no errors. Migration 047 corrects the tenant
  guard's volatility declaration; two historical unused-variable warnings remain
  non-blocking cleanup items.
- The first synthetic seed attempt exposed nondeterministic loyalty ordering when
  multiple rows shared `created_at`; random UUID order could make a valid redeem
  appear negative. Migration 048 now derives balance from the sum of prior points
  under the existing advisory lock.
- Staging seed then completed with 3 shops, 24 products, 9 customers, 12
  inventory rows, 10 loyalty rows, 3 invoices, and all campaign rules inactive.
- Anonymous expand-phase checks: public receipt RPC returned one seeded invoice;
  customers remained hidden; legacy shop/product/invoice fields remain visible
  until the post-application contract migration 049.
- Browser baseline: Playwright public smoke passed; direct agent-browser check
  returned `OK` for framework overlays, `HAS_CONTENT` for body content, and
  rendered the expected landing navigation/CTA elements.
- Vercel preview `dpl_AropTWZdDSNN7ZJ7pLnuVDr84vKj` is `READY` for commit
  `73786af`. Branch-scoped variables use the staging Supabase URL, publishable
  key, and modern secret key. A browser bundle scan found the staging ref and no
  production ref.
- The first GitHub `quality` run passed typecheck, lint, and all 33 tests but its
  build step lacked required public Supabase configuration. CI now supplies
  non-secret placeholders scoped only to `npm run build`; it does not use a live
  database or deployment credentials.
- Staging legacy-key remediation: JWT-based `anon`/`service_role` API keys were
  disabled and the previous HS256 signing key was revoked after modern-key
  verification. The legacy service-role credential now returns HTTP 401; modern
  secret admin access and publishable receipt access both still pass.
- Post-remediation local gate: strict typecheck, ESLint, 33 unit tests, the
  25-route production build, and the Playwright public smoke test all pass.
  Linked schema lint has no errors and retains two documented historical
  unused-variable warnings.

## Wave entry template

```text
Date / domain:
Before ownership and LOC:
After ownership and LOC:
Behavior contracts exercised:
Automated checks:
Manual checks:
Visual comparison:
Commit / PR / preview:
Production result:
Rollback point:
Known follow-ups kept out of scope:
```
