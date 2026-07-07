# BharatGrowth Current Architecture

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
- Explicit opt-in before marketing messages.
- Opt-out handling for marketing automation.
- Rate limiting and provider-level error monitoring before broad use.

## Database Migrations

Migrations currently run through `035_save_invoice_ownership_guards.sql`.

Important recent migrations:

- `034_storefront_idempotency.sql`
- `035_save_invoice_ownership_guards.sql`

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
