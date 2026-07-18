# Current Architecture

Last source verification: 2026-07-18 at Wave 7 integration checkpoint
`053abca`. All seven decomposition waves are merged only into integration.
Runtime truth must be rechecked before every external or production action.

## Product shape

BharatGrowth is one Next.js application containing:

- a public positioning page;
- Supabase phone/email authentication and first-shop onboarding;
- a protected desktop operator workspace for billing, products, purchases,
  orders, campaigns, reporting, and settings;
- a public mobile storefront selected from Modern, Industrial, or Festive theme;
- a public mobile digital receipt;
- protected API routes for onboarding, checkout, bill scanning, and WhatsApp;
- a scheduled campaign route;
- Postgres/RLS/RPC business and transaction logic.

The source-backed product and behavior map is
[`../product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](../product/FEATURE_AND_BEHAVIOR_INVENTORY.md).

## Runtime stack

- Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS.
- Vercel Git integration with Mumbai (`bom1`) functions/previews.
- Supabase Postgres, Auth, Storage, Realtime, RLS, and RPCs.
- Vitest/Testing Library characterization, Playwright browser checks, and
  GitHub Actions CI.
- Integer paise at database/API boundaries; UTC storage with documented IST
  display/range/financial-year rules.

Production Supabase project ref is `vyycczqhvsgkiqtxxxos`; decomposition staging
is `qokaaggeqahayxsybgds`. Production application is
`https://bharat-growth.vercel.app`. Project refs are identifiers, not
credentials; secret values never belong in docs.

## Tenant and trust boundaries

- `shops.id` / `shop_id` is the tenant boundary.
- `auth.users` identifies a person; `public.users` binds active role/membership
  to a shop.
- Protected UI resolves the authenticated membership. Protected server routes
  validate Auth and derive/verify the shop server-side.
- Browser-supplied shop identifiers are not authoritative for protected writes.
- RLS and tenant-aware RPCs are required even when the UI already filters.
- The Receipt UI uses the constrained receipt RPC. The current browser
  Storefront loader selects documented shop/product/owner fields through the
  temporary anonymous compatibility policies from migrations 013/014. A
  constrained owner-phone RPC and server query module exist, but migration 049
  must not remove the old policies until every live public consumer is proven
  compatible with the narrow path.
- Admin/service credentials remain server-only.

## Route and module map

| Domain | Route/surface | Current ownership after all seven waves |
|---|---|---|
| Auth/onboarding | `/login`, `/auth/callback`, `/onboarding` | Page/API orchestration plus `src/lib/auth/*`. |
| Billing/POS | `/billing` | Thin page composition over Billing hooks/transforms and focused views; the stable query facade delegates to focused search, invoice, customer, and shop query modules. |
| Dashboard | `/dashboard` | 117-line route over presentation transforms, four hooks, and focused views; the stable query facade delegates to KPI, analytics, retention, stock, GST, and orchestration modules. |
| Products | `/dashboard/products` | Thin page over product form transforms, data/editor hooks, and focused product views. |
| Purchases | `/dashboard/purchases/new`, `/history` | New Purchase is a 78-line composition over transforms/hooks/views; History remains its existing 317-line route. |
| Orders | `/dashboard/orders` | Thin tab composition over presentation/controller modules and focused Sales/PO views; the stable query facade delegates to fetch and mutation modules. |
| Campaigns | `/dashboard/campaigns`, cron/API | Campaign page, default/seed modules, database matcher, scheduled sender, WhatsApp service. |
| Storefront | `/store/[shop_id]` | Unchanged loader over a stable 7-line compatibility facade delegating to public shop/contact and catalog query modules; 77-line Modern composition over catalog/cart/checkout transforms, controllers, and focused views; Industrial/Festive remain unchanged. |
| Receipt | `/receipt/[id]` | Public page plus mobile `ReceiptLoader` over constrained RPC. |
| Settings/navigation | `/settings`, `TopNav` | Tax/GST settings and stable protected navigation. |
| Progress | `/progress` | LocalStorage-backed product-build tracker, independent of shop analytics. |

## Core data flows

### Billing

Authenticated membership and shop settings feed customer/product search and the
keyboard-driven line-item store. Pure billing transforms calculate paise totals
and GST. Payload builders preserve item/customer order. Transactional RPCs save
invoice/items and associated stock/ledger effects. Follow-up paths print, send a
receipt, alert stock, or create a Sales Order. POS intentionally permits negative
stock.

### Purchasing and orders

New Purchase maps manual or scanned supplier rows to catalog products. Saving a
bill uses the atomic purchase-bill RPC and receives stock. Saving a draft
Purchase Order does not change stock. Order Management loads Sales Orders first,
lazy-loads POs, and uses guarded conversions/cancellations. Wave 7 split the
query implementation without changing those reads, RPCs, guards, or call order.

### Storefront checkout

The loader retrieves selected shop/owner fields and an active catalog with
inventory through the current compatibility policies, then
dispatches exactly one of three themes. Industrial and Festive offer
per-product WhatsApp links. Modern owns search/category filtering, a strict-stock
cart, required order-data consent, optional marketing consent, and UPI/Khata
checkout. The checkout API validates the request and calls the server
`create_online_order` RPC, which owns current product/price/stock and
idempotency. WhatsApp navigation happens only after a successful order response.

### Receipt

A public UUID route calls a security-definer receipt RPC returning a minimal
receipt snapshot. The client renders GST/composition/payment details and offers
print/share. The route is no-indexed.

### Retention and messaging

Onboarding seeds business-type campaign rules inactive. Product tags connect
purchases to repurchase-cycle rules. The scheduled route authorizes with a
Bearer secret, asks the database matcher for eligible consented customers,
claims a send before calling the WhatsApp service, and records/releases the
claim according to provider outcome. The inbound webhook verifies Meta where
configured and handles global marketing opt-out for the shared sender.

### Dashboard and reporting

The `dashboardQueries.ts` compatibility facade delegates selected IST period
metrics, charts, stock, khata, retention, GST, and orchestration to focused query
modules under the same authenticated singleton client. Extracted presentation
transforms build labels, totals, colors, and GST filename. Focused hooks own GST
export, khata reminder, and stock reconciliation. The `/progress` route does not
use this data flow.

## Database responsibility

Migrations 001–048 currently define the shop/user model, products, customers,
consent, invoices/items, loyalty, inventory, public storefront/receipt access,
UPI/images, automated campaigns, khata, GST, online orders, hybrid inventory,
purchase ledger/bills, Sales/Purchase Orders and conversions, checkout
idempotency, campaign ROI/matching, repayment, AI quota, and tenant/RLS
hardening. Migration 042 is additive: it adds constrained public RPCs while the
legacy anonymous policies remain for application compatibility. Migration 049
is the later contract step and must follow consumer verification.

Financial, stock, order, ledger, loyalty, checkout, and quota operations that
touch multiple rows stay transactional in RPCs. A decomposition must not pull
transaction authority into the browser.

## External dependencies and readiness distinction

- Supabase and Vercel staging paths are verified for the current integration
  application checkpoint.
- WhatsApp service code exists, including simulation and webhook paths, but
  production Meta credentials/templates/configuration are external gates.
- AI bill scan code and quota enforcement exist; a real approved staging scan is
  a separate release check.
- Vercel/Supabase operational inspection exists; production error monitoring
  remains a launch blocker.
- Razorpay subscriptions/payment gateway, offline billing, bilingual UI,
  e-invoicing, loyalty redemption, and full DPDP erasure are planned, not current
  architecture.

## Decomposition architecture rules

- One domain per PR into the integration branch.
- Characterization precedes application extraction.
- Pure transforms, then controllers/hooks, then focused views.
- Keep routes/composition thin without inventing abstractions.
- Waves 1–6 preserved query facades. Completed Wave 7 split only their
  implementation behind the same compatibility exports.
- The original Billing, Orders, Dashboard, and Storefront query module paths,
  names, signatures, defaults, client trust boundaries, query shapes, call
  sequence, errors, fallbacks, and result mapping remain contracts.
- Do not change schema, migrations, RLS, API/RPC contracts, copy, styles, visual
  output, focus, keyboard, stock, consent, or provider workflow.
- Generated/general UI primitives are outside the decomposition without a
  demonstrated defect.

## Wave 7 data-access ownership

- Billing: `billingQueries.ts` delegates to client, types, search, invoice,
  customer, and shop modules.
- Orders: `orderQueries.ts` delegates to shared types/constants plus fetch and
  mutation modules.
- Dashboard: `dashboardQueries.ts` delegates to client, date-range, KPI,
  analytics, retention, stock, GST, and orchestration modules.
- Storefront: `queries.ts` delegates to public shop/contact and catalog modules.

Twenty-four characterization tests pin exact select strings, filters and
arguments, sorting/null behavior, limits/ranges, RPC names/full argument
objects, table/client/call sequence, errors, fallbacks, and result shaping. All
32 base consumers have zero Wave 7 diff.
