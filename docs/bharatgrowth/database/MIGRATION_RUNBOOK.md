# Supabase Migration Runbook

Production project ref: `vyycczqhvsgkiqtxxxos`.

## Hard stops

- Do not print access tokens, database passwords, service-role keys, or pulled
  environment values.
- Do not run a push until the CLI-displayed project ref matches the intended
  target and a dry run has been reviewed.
- Stop on migration history drift, duplicate versions, destructive statements,
  unexpected policy/grant removal, or an unreviewed target.
- Never test destructive behavior with production customer data.

## Pre-launch production identity gate

- Before the production application/database rollout, delete
  `dev@bharatgrowth.in` from production `auth.users` and delete its matching
  `public.users` row.
- Resolve and verify the exact production user ID before either deletion; do not
  identify the row by a guessed ID.
- Verify that neither table contains the account after deletion and record the
  evidence in the decomposition log. Do not print credentials or tokens.

## Staging preparation

1. The owner selects which non-production Free Plan project to pause.
2. Create `bharat-growth-staging`; production remains active.
3. Authenticate Supabase CLI and link explicitly to the staging project.
4. Apply the historical migrations to an empty staging database.
5. Load only synthetic/sanitized fixtures and create dedicated test users.
6. Verify migration history before testing the new migrations.

### Verified staging baseline — 2026-07-12

- Project ref: `qokaaggeqahayxsybgds`; production was not linked or changed.
- Migrations 001-048 reproduced successfully from an empty project.
- Synthetic seed loaded; no production/customer data was copied.
- The deployed preview uses publishable and secret API keys. Legacy JWT-based
  API keys are disabled and the previous HS256 signing key is revoked.
- Read-only verification: legacy service-role access returns HTTP 401, modern
  secret admin access passes, public receipt RPC passes, and anonymous customer
  reads remain blocked.

## Expand / application / contract

1. **Expand:** migration 042 creates constrained public RPCs without removing the
   old compatible grants/policies. Migrations 043-046 add compatible fixes.
2. Run `supabase db push --dry-run`, inspect the exact SQL, apply to staging, and
   verify function signatures, ownership, `search_path`, grants, RLS, tenant
   isolation, concurrency, and idempotency.
3. Deploy the compatible app against staging and run receipt/storefront plus
   transactional smoke tests.
4. Repeat the dry run against production and apply only the expand set.
5. Deploy the application and verify production.
6. **Contract:** create a later migration 049 that removes obsolete anonymous
   access only after the new app is healthy. Dry-run, apply, and reverify.

The contract migration must not exist in the branch used for the expand push;
`supabase db push` applies every pending migration.

## Required database cases

- Anonymous full-table and sensitive-column reads are denied.
- Public receipt by UUID and storefront contact/catalog still work.
- Cross-shop identifiers fail.
- Fractional sales-order conversion produces correct totals and stock movement.
- Composition conversion produces a bill of supply with zero tax.
- Concurrent credit sale/repayment leaves balance equal to ledger history.
- Loyalty balance cannot be overwritten by stale client state.
- Concurrent AI scans cannot consume quota below zero.

## Recovery

- Leave compatible additive functions/columns in place during application
  rollback.
- Revert application by promoting the recorded last-known-good Vercel artifact or
  reverting the merge.
- Reverse a contract permission change only through a reviewed forward recovery
  migration that restores the minimum prior grants/policies.
- Record every applied migration and result in the decomposition log.
