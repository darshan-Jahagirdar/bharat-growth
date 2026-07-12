# Current Architecture

Last code verification: 2026-07-11. Runtime truth must be rechecked before every
production release.

## Runtime

- Next.js 15 App Router and React 19, deployed through Vercel Git integration.
- Supabase provides Postgres, Auth, Storage, RLS, and transactional business RPCs.
- Money is represented as integer paise at database and API boundaries.
- `shops.id` / `shop_id` is the tenant boundary.
- Production Supabase project ref: `vyycczqhvsgkiqtxxxos`.
- Production application: `https://bharat-growth.vercel.app`.

## Trust boundaries

- Protected pages use the authenticated user's shop membership.
- Server routes must validate the user with Supabase Auth and derive `shop_id`
  server-side; browser-supplied tenant identifiers are not authoritative.
- Public storefront and receipt flows expose only their documented RPC/API
  response shapes.
- POS intentionally permits negative stock. Storefront and online-order paths
  use strict stock enforcement.
- Database RPCs own multi-table financial and stock transactions.

## Large orchestration surfaces at baseline

| Surface | Baseline lines | Intended responsibility after decomposition |
|---|---:|---|
| Billing page | 1,412 | Route composition over billing hooks and focused views. |
| Orders page | 1,127 | Tab composition over sales/purchase order modules. |
| Products page | 1,004 | Product, inventory, and tag orchestration. |
| Dashboard page | 973 | Data orchestration over metric and chart sections. |
| New purchase page | 871 | Purchase controller plus focused form/grid components. |
| Modern storefront theme | 717 | Theme composition over catalog, cart, and checkout modules. |
| Dashboard queries | 672 | Compatibility facade over use-case query modules. |

Generated/general UI primitives are not decomposition targets unless they contain
a demonstrated defect.

## External production dependencies

- Supabase Auth redirect URLs and provider configuration.
- Vercel environment variables and cron configuration.
- Meta WhatsApp webhook verification, app secret, phone number, and approved
  message templates.
- Monitoring and operational alerting, which remain a launch gate until verified.
