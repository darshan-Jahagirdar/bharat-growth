# BharatGrowth Current Architecture

> Historical architecture detail. The maintained overview is
> [`docs/bharatgrowth/architecture/CURRENT_ARCHITECTURE.md`](bharatgrowth/architecture/CURRENT_ARCHITECTURE.md).

Last verified from local code: July 7, 2026.

## Runtime Stack

- Next.js App Router application hosted on Vercel.
- Supabase provides Postgres, Auth, Storage, and RPC-backed business logic.
- Supabase project: `vyycczqhvsgkiqtxxxos`.
- Production app: `https://bharat-growth.vercel.app`.
- Monetary values are represented as integer paise in database and API contracts.

## Tenant Model

The current tenant boundary is `shops`, with business tables keyed by `shop_id`.
Older docs that mention a generic `tenant_id` should be treated as stale unless the code and schema are changed to match.

Protected app data should always be scoped through the authenticated user's active `users.shop_id` membership. Public storefront routes are scoped by the storefront shop id and must use server-side validation before writing.

## Auth

Supabase Auth is the identity provider.

Current app behavior supports:

- Phone OTP login.
- Email magic-link login.
- `/auth/callback` for Supabase email confirmation and magic-link redirects.

Required Supabase Auth URL settings:

- Site URL: `https://bharat-growth.vercel.app`
- Redirect URL: `https://bharat-growth.vercel.app/auth/callback`
- Redirect URL for local testing: `http://localhost:3000/auth/callback`

The common failure mode for email links is Supabase redirecting to `localhost:3000` while no local server is running. Fix that in the Supabase Auth URL configuration before broad tester invites.

## Main Surfaces

Public:

- `/`
- `/store/[shop_id]`
- `/receipt/[id]`
- `/api/storefront/checkout`

Protected app:

- `/billing`
- `/dashboard`
- product, purchase, order, settings, and onboarding flows under `src/app`

Server-protected:

- `/api/cron/campaigns` requires `CRON_SECRET`.
- WhatsApp send routes require an authenticated shop user and now load invoice, customer, product, and shop details from the database instead of trusting browser-supplied message payloads.

## Storefront Checkout

The storefront checkout route is public but server-authoritative:

- API input is Zod validated.
- Consent is required.
- Product price, name, HSN, unit, GST, and stock rules come from the database.
- `create_online_order` handles strict stock behavior for online orders.
- Checkout idempotency is supported through `idempotency_key`.

Storefront and online order acceptance are strict-stock flows. They should not allow negative inventory.

## POS Billing

POS billing intentionally allows negative inventory for speed and offline-friendly operation. This is a product decision for in-store billing only.

Current hardening:

- `shop_id` is authenticated and guarded by RPC logic.
- Non-null invoice `product_id` values must belong to the current shop.
- Credit/khata customer ids must belong to the current shop.

Known fast-follow:

- POS totals and GST are still client-supplied. Server-authoritative recomputation of catalog line price, GST breakup, discounts, and totals is required before positioning BharatGrowth as compliance-grade GST billing at scale.

## WhatsApp Messaging

WhatsApp send APIs should be treated as trusted server-side actions, not browser-authored messages.

Current behavior:

- Receipt send accepts only `invoice_id`.
- Khata reminder send accepts only `customer_id`.
- Low-stock alert send accepts only `product_id`.
- Each route verifies the signed-in user's shop and loads final message fields from Supabase.

External requirements still apply:

- Meta-approved templates for production campaigns.
- Provider-level error monitoring before broad use.

## Bring-Back Campaign Engine (July 2026)

The campaign engine is consent-gated and template-based end to end:

- Matching lives in the `find_campaign_matches()` RPC (migration 037): enforces
  `dpdp_marketing_consent = true`, completed invoices only, IST date windows
  with a 2-day grace window, `(invoice_id, rule_id)` dedupe, a 7-day
  per-customer cooldown, and a per-shop daily send cap (default 50).
- The cron route (`/api/cron/campaigns`) authenticates via
  `Authorization: Bearer CRON_SECRET` (Vercel Cron, 10:00 IST daily) and uses
  claim-then-send: the `message_logs` row is inserted before the WhatsApp call
  so overlapping runs cannot double-send. Consent is re-checked immediately
  before each send.
- Campaign sends use Meta template keys (`campaign_rules.template_key` +
  `custom_variable`, migration 036) — no free text in template variables.
- Opt-out: `/api/whatsapp/webhook` (Meta signature-verified) revokes marketing
  consent across all shops for the replying phone number via
  `revoke_marketing_consent_by_phone()` (migration 038) and writes
  `consent_logs` rows. Requires `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and
  `WHATSAPP_APP_SECRET` in production.
- Marketing consent capture: POS customer-create modal (verbal_recorded) and
  optional storefront checkout checkbox (migration 039, OR semantics — an
  unticked box never downgrades an existing opt-in).
- ROI proof: `get_retention_stats()` RPC (migration 041) powers the dashboard
  Bring-Back card and the per-rule stats on `/dashboard/campaigns`. Attribution
  itself is unchanged (save_invoice marks conversions within 14 days).
- Vertical defaults: onboarding seeds inactive per-vertical tags + rules
  (`src/lib/campaigns/defaults.ts`); pre-existing shops retrofit via
  `POST /api/campaigns/seed-defaults`.
- Known gap: `accept_online_order` has no attribution block, so storefront
  conversions do not yet count toward Bring-Back ROI (v1.1 follow-up).

## Database Migrations

Migrations currently run through `041_get_retention_stats_rpc.sql`.

Important recent migrations:

- `034_storefront_idempotency.sql`
- `035_save_invoice_ownership_guards.sql`
- `036_campaign_rules_template_columns.sql` (template_key / custom_variable / name)
- `037_find_campaign_matches_rpc.sql` (consent-gated campaign matching)
- `038_revoke_marketing_consent_rpc.sql` (webhook opt-out)
- `039_online_order_marketing_consent.sql` (storefront marketing opt-in)
- `040_message_logs_roi_indexes.sql`
- `041_get_retention_stats_rpc.sql` (Bring-Back ROI stats)

Before applying migrations to production:

1. Apply to preview or staging first.
2. Confirm the same migration numbers were not manually applied.
3. Run browser and transactional smoke tests.
4. Only then deploy production and run a tiny live smoke.

## Security And Quality Notes

Current high-value fast-follows:

- Server-authoritative POS totals and GST recomputation.
- Atomic quota decrement for AI bill scan usage.
- Continued replacement of server-side `getSession` use with `getUser` in higher-risk routes.
- Formal rate limiting for public and messaging APIs.
- Sentry or equivalent error tracking before wider invite testing.

Do not migrate or upload:

- `.env.local`
- `.vercel/`
- `.next/`
- `node_modules/`
- `repomix-output.xml`

`repomix-output.xml` has secret-like and environment-variable content and should be regenerated only when needed, then deleted or kept local.
