# Supabase Migration Runbook

Last reconciled: 2026-08-01.

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

Verified on 2026-07-19:

- CLI link resolves to staging `qokaaggeqahayxsybgds`.
- Fresh `supabase migration list --linked` returns matching continuous local and
  remote migrations 001–050.
- The staging project was rebuilt from migrations with synthetic/shared test
  data; no production/customer data was copied.
- Migration 049 removed direct anonymous invoice, invoice-item, and user table
  reads. The constrained receipt and owner-phone RPCs and the exact Storefront
  column allowlists remain functional; anonymous direct-table denial and public
  facade behavior were rechecked during sale-readiness burn-down.
- Legacy exposed staging credentials are disabled/revoked; no key material is
  recorded here. Remaining credential rotation is a pre-sale owner gate, not a
  decomposition action.

Migration 050 adds `grocery` to the `shops.business_type` CHECK constraint and
was applied to staging on 2026-08-01 after a reviewed dry run. It changes no
campaign engine, message-log, retention-stat, attribution, RLS, policy, grant,
or function behavior. Production has not received migrations 049–050. Recheck
the linked ref and migration-list readback before every later database action
and stop on drift.

## Durable staging fixtures

- Staging intentionally contains one persistent synthetic `public.users` owner
  fixture. It links the single user-owned staging Auth identity to one seeded
  shop, is active, and has a synthetic phone value so the owner-phone RPC and
  WhatsApp storefront state can be regression-tested.
- This fixture is shared verification infrastructure for migration 049 and the
  sale-readiness regression. It is not disposable test residue: do not clean it
  up during ordinary preview, migration, or handoff housekeeping.
- The fixture contains no production or customer data. Keep its identity, shop
  identifier, and phone value out of logs and documentation.
- For login, the application sends canonical `+91XXXXXXXXXX` E.164. Supabase
  Auth removes the leading plus before lookup, so the fixture's Auth user and
  hosted fixed-OTP key use the corresponding `91XXXXXXXXXX` country-code
  digits. Keep those two hosted values aligned; a mismatch falls through to the
  external SMS provider instead of using the synthetic OTP.
- Staging Auth also has a permanent callback fixture. Its Site URL is the stable
  integration preview alias,
  `https://bharat-growth-git-codex-pro-fbbd8e-darshan-jahagirdars-projects.vercel.app`,
  and its redirect allowlist retains `http://localhost:3000/**` for local
  development plus
  `https://bharat-growth-*-darshan-jahagirdars-projects.vercel.app/**` for
  ephemeral integration previews. This configuration is staging-only and is
  not disposable regression residue; do not restore it during cleanup.
- Never place that Vercel wildcard on production. Production callback origins
  require an explicit, narrow release decision.

## Auth email OTP configuration

Hosted Supabase `signInWithOtp({ email })` uses the Auth **Confirm signup**
template for a new identity and the **Magic Link** template for an existing
identity. Both templates must deliver the typed code; configuring only Magic
Link silently breaks first-time sign-in. Staging has both templates saved with
the exact values below. Production must receive the identical values only in
the separately approved rollout.

### Confirm signup template

Subject (exact): `Your BharatGrowth verification code`

Body (exact):

```html
<h2>Your BharatGrowth verification code</h2>
<p>Enter this code to sign in:</p>
<p><strong>{{ .Token }}</strong></p>
<p>This code expires shortly and can only be used once.</p>
```

Hosted Auth configuration fields:
`mailer_templates_confirmation_content` and
`mailer_subjects_confirmation`.

### Magic Link template

Subject (exact): `Your BharatGrowth verification code`

Body (exact):

```html
<h2>Your BharatGrowth verification code</h2>
<p>Enter this code to sign in:</p>
<p><strong>{{ .Token }}</strong></p>
<p>This code expires shortly and can only be used once.</p>
```

Hosted Auth configuration fields:
`mailer_templates_magic_link_content` and
`mailer_subjects_magic_link`.

Both bodies intentionally contain no link, `ConfirmationURL`, or `TokenHash`.
These values are hosted Auth configuration, not a database migration.

### Custom SMTP shape

Staging sends Auth email through custom SMTP with this non-secret shape:

- provider: Resend
- verified domain: `bharatgrowthshop.com`
- host: `smtp.resend.com`
- port: `465`
- username: `resend`
- sender email: `login@bharatgrowthshop.com`
- sender name: `BharatGrowth`
- minimum interval per user: `60` seconds
- staging email rate cap: `30` emails per hour

The SMTP credential is intentionally omitted. Never request, print, or persist
it. Production rollout must reproduce this configuration shape and inject its
credential through the approved secret-management path.

## Migration 049 staging result

- PR #12 moved Storefront owner-contact loading to the constrained RPC and was
  merged at `3cca263`.
- PR #13 delivered migration 049. Integration reached the post-049 checkpoint
  `e5147d1`; staging migrations 001–049 are continuous and verified.
- Anonymous direct reads of `invoices`, `invoice_items`, and `users` are denied.
  Public receipt, owner contact, Storefront catalog/stock semantics, and checkout
  remain functional through the constrained contracts.
- Production remains untouched. This completed staging result is not
  authorization for a production migration push.

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
