# Supabase Migration Runbook

Last reconciled: 2026-07-18.

- Production project ref: `vyycczqhvsgkiqtxxxos`.
- Decomposition staging project ref: `qokaaggeqahayxsybgds`.

Project refs are identifiers, not authorization. Recheck the CLI link and exact
remote migration history before every database command.

## Hard stops

- Do not print access tokens, database passwords, service-role/secret keys, OTPs,
  or pulled environment values.
- Do not run a push until the CLI-displayed project ref matches the explicitly
  intended target and a dry run has been reviewed.
- Stop on migration-history drift, duplicate versions, destructive statements,
  unexpected policy/grant removal, changed function signatures, or an
  unreviewed target.
- Never test destructive behavior with production customer data.
- No schema/migration/RLS/grant/policy/function change belongs in a
  decomposition wave.
- Production work requires a new explicit Darshan approval at the final gate.

## Current staging baseline

Verified on 2026-07-18:

- CLI link resolves to staging `qokaaggeqahayxsybgds`.
- Fresh `supabase migration list --linked` returns matching continuous local and
  remote migrations 001–048.
- The staging project was rebuilt from migrations with synthetic/shared test
  data; no production/customer data was copied.
- Constrained receipt and owner-phone RPCs, tenant isolation outside the known
  legacy public policies, transactional cases, and migration safety were
  verified during hardening. Migrations 013/014 anonymous compatibility policies
  intentionally remain because the current Storefront loader still uses them.
- Legacy exposed staging credentials are disabled/revoked; no key material is
  recorded here. Remaining credential rotation is a pre-sale owner gate, not a
  decomposition action.

Wave 7 completed without a migration, schema, RLS, grant, policy, or function
change. Before any migration 049 work, repeat the linked ref and migration-list
readback and stop on drift.

## Migration 049 staging gate

All seven decomposition waves are merged and staging-smoked at integration
checkpoint `053abca`. This satisfies only the sequencing prerequisite; it is not
authorization to write or apply migration 049. After Darshan approves that
specific scope:

1. Re-read the approved `CODEX_BRIEF.md` and current handoff.
2. Re-derive production and staging histories; stop if the assumed production
   pending range is not exact.
3. Prove every Receipt/Storefront consumer no longer depends on the legacy
   anonymous table policies. The current browser Storefront loader is a named
   dependency to resolve or replace in a separately approved behavior-preserving
   hardening change; do not assume it is already safe.
4. Write the reviewed contract migration 049 that removes only access proven
   obsolete by that consumer audit.
5. Review SQL for destructive statements, grants/policies, function ownership,
   stable/security-definer attributes, `search_path`, and public shapes.
6. Run `supabase db push --dry-run` against staging and review every pending
   statement.
7. Apply only to staging.
8. Re-run the complete required database cases and public app smoke. Record exact
   migration and result evidence.

Do not create migration 049 early in a branch whose ordinary staging push should
apply only existing history; `supabase db push` applies all pending migrations.

## Required staging database cases

- Anonymous customer/invoice/user/loyalty and sensitive-column reads are denied.
- Public receipt by UUID and public storefront contact/catalog still work.
- Invalid and cross-shop identifiers fail.
- Online checkout enforces current price, strict stock, idempotency, and consent.
- POS negative stock remains allowed.
- Fractional Sales Order conversion produces correct totals and stock movement.
- Composition conversion produces a Bill of Supply with zero tax.
- Purchase bill atomically records header/movements/stock; draft PO does not
  receive stock.
- Concurrent credit sale/repayment leaves balance equal to ledger history and
  rejects overpayment.
- Loyalty balance cannot be overwritten by stale client state.
- Concurrent AI scans cannot consume quota below zero.
- Campaign matching respects consent, daily cap, duplicate claim, and provider
  result rules.

## Approved pre-launch production rollout model

There are no real users and the production database contains test data, so the
approved brief intentionally removes a long compatibility window. This changes
the final release choreography, not the staging-first or verification rules.

At the separately approved production gate:

1. Resolve and verify the exact production Auth identity for
   `dev@bharatgrowth.in` and its `public.users` membership. Delete both during
   the controlled gate; never identify the row by a guessed UUID and never print
   credentials.
2. Reconfirm the exact reviewed application commit, migration range, Vercel
   production project, and Supabase production ref.
3. Run and review a production dry run. The approved brief expects migrations
   036–049 pending, but live history—not this sentence—decides the actual range.
4. Apply the reviewed migrations and exact application release as one
   staged-then-production rollout, with the bounded checks and rollback assets
   ready. Do not insert an unapproved gradual/compatibility choreography.
5. Verify Auth cleanup, migration history, public/private boundaries,
   transactions, routes, logs, monitoring, and provider dependencies.
6. Record exact evidence in the engineering log, Google handoff, and Slack only
   after the gate is true.

This section is not authorization to perform the rollout now.

## Recovery

- Prefer application rollback to the recorded last-known-good Vercel artifact or
  a reviewed revert.
- Keep compatible additive database changes when rolling back code unless a
  reviewed forward recovery migration is required.
- Restore a restrictive permission only through a reviewed forward migration
  that grants the minimum prior access.
- Stop scheduled campaigns/provider actions if their dependencies are unhealthy.
- Record every applied migration, recovery action, and final verification.
