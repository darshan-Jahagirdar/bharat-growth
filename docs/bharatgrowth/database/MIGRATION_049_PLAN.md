# Migration 049 — RLS Contract Cleanup (Plan)

**Author:** Claude (architecture/review), 2026-07-18. **Implementer:** Codex.
**Status:** Ready to implement. Staging-first. Production applies only inside the
approved single staged-then-prod rollout, never alone.

## 1. What this is

The **contract** half of the expand/contract split begun by migration 042.
042 added constrained SECURITY DEFINER RPCs (`get_public_receipt`,
`get_storefront_owner_phone`) — the expand phase. The app has since been
verified on those RPCs. 049 removes/tightens the temporary anonymous table
policies so the public anon key can no longer read cross-shop PII, GSTIN/PAN,
or cost prices (audit findings F11–F14).

This migration changes **only** what the `anon` role can read. The
`authenticated` role, all RLS for logged-in shop users, and every RPC are out
of scope and must be untouched.

## 0. PREREQUISITE — one-line app change (must merge before 049 applies)

`StorefrontLoader.tsx` (lines ~55–62) fetches the owner phone with a direct
anon read of `users`:

```ts
const { data: ownerData } = await supabase
  .from('users').select('phone')
  .eq('shop_id', shopId).eq('role', 'owner').eq('is_active', true)
  .limit(1).maybeSingle();
```

Replace **only this query** with the existing anon-executable RPC, preserving
the non-blocking semantics (failure → `owner_phone: null`, storefront still
renders):

```ts
const { data: ownerPhone } = await supabase.rpc(
  'get_storefront_owner_phone', { p_shop_id: shopId }
);
// owner_phone: typeof ownerPhone === 'string' ? ownerPhone : null
```

Constraints:
- **Smallest possible diff.** Do NOT swap the loader to the facade functions
  wholesale — `getStorefrontShop` collapses the not_found (PGRST116) vs error
  distinction and uses `createPublicClient` instead of the browser client;
  both are visible behavior changes. Only the `users` query moves to the RPC.
- The shops/products/inventory inline queries in the loader are byte-identical
  to the facade's select strings — they stay as-is; §3 allowlists cover them.
- Update the Wave 6/7 characterization tests that pin the direct `users` query
  shape to expect the RPC call instead — this is a deliberate, approved
  contract change, not drift.
- Verify on a staging preview: storefront renders, WhatsApp CTA/checkout
  button shows the phone-backed state (not "Shop contact not available").
- Ship as its own small PR into integration before the 049 migration PR.

**Verified single straggler (repo-wide grep, 2026-07-18):** every other
`from('users'|'invoices'|'invoice_items')` in `src/` is server-side or behind
login (`authenticated` role — untouched by 049). `ReceiptLoader.tsx` uses
`get_public_receipt`. After §0, no anon consumer of the three dead tables
remains.

## 2. Current anon policy inventory → 049 action

> **Corrected 2026-07-18 after Codex's pre-write audit stop:** the original
> version of this table wrongly claimed `users` had no anon consumer. The live
> route `src/app/store/[shop_id]/StorefrontLoader.tsx` queries `users.phone`
> directly (it never imports the RPC-based facade — only its types). §0 below
> is now a hard prerequisite before 049 can be applied.

| Table | Policy (source migration) | Rule | Anon app consumer today | 049 action |
|---|---|---|---|---|
| `invoices` | "Public read invoice by id" (014) | `USING(true)` | None — receipt uses `get_public_receipt` RPC (verified: `ReceiptLoader.tsx` calls the RPC) | **DROP policy + REVOKE all table grants from anon** |
| `invoice_items` | "Public read invoice items by invoice_id" (014) | `USING(true)` | None — same RPC | **DROP policy + REVOKE all table grants from anon** |
| `users` | "Public read owner phone" (013) | `role='owner' AND is_active` | **`StorefrontLoader.tsx` direct read — must be removed via §0 first** | **DROP policy + REVOKE all table grants from anon — only after §0 is merged and verified** |
| `shops` | "Public read shops" (013) | `USING(true)` | `getStorefrontShop` (`storefrontShopQueries.ts`) | **KEEP row policy; REVOKE table SELECT; GRANT column allowlist** |
| `products` | "Public read active products" (013) | `USING(is_active=true)` | `getStorefrontProducts` (`storefrontCatalogQueries.ts`) | **KEEP row policy; REVOKE table SELECT; GRANT column allowlist** |
| `inventory` | "Public read inventory stock" (021) | `USING(true)` | PostgREST embed `inventory(quantity_in_stock)` from products query | **KEEP row policy; REVOKE table SELECT; GRANT column allowlist** |

**Why DROP + REVOKE (not just DROP) on the three dead tables:** policies and
grants are separate locks. Dropping only the policy makes stray anon queries
return silently empty (0 rows); revoking the grant makes them **fail loudly**
with a permission error. Loud failures surface forgotten consumers during
staging verification and protect against a future accidental permissive-policy
re-add.

## 3. Column allowlists (exact — derived from the live queries)

Mechanism per kept table: `REVOKE SELECT ON <table> FROM anon;` then
`GRANT SELECT (<cols>) ON <table> TO anon;`

> ⚠️ Postgres requires SELECT privilege on every column used in `SELECT`,
> `WHERE`/`.eq()`, **and** `ORDER BY`/`.order()` — not just returned columns.
> A missing filter/order column = storefront 400s.

- **`shops`** → `id, business_name, business_type, city, state_code, logo_url,
  theme_preference, primary_color`
  Excludes (the leak): `gstin`, `pan`, `phone`, `address_line_*`, `upi_id`,
  `email`, `gst_type`, and everything else.
- **`products`** → `id, name, sku, hsn_code, selling_price_paise,
  gst_rate_percent, unit, category, image_url, vertical_attrs,
  is_stock_tracked` **plus** `shop_id, is_active` (used by `.eq()` filters and
  the row policy).
  Excludes (the leak): `purchase_price_paise` (added in 025) and any
  supplier/margin columns.
- **`inventory`** → `quantity_in_stock` **plus the FK column PostgREST needs to
  resolve the `products → inventory` embed** (expected `product_id`; Codex must
  confirm the actual FK column, and whether `shop_id` participates, from the
  live schema before writing the grant).
  Excludes: any cost/valuation columns.

## 4. Mandatory pre-write audit (do this BEFORE writing 049)

The tables above were derived from migration files. The live database is the
truth. On **staging**, run read-only:

```sql
SELECT * FROM pg_policies WHERE 'anon' = ANY(roles) OR roles = '{public}';
SELECT grantee, table_name, privilege_type, column_name
FROM information_schema.role_column_grants WHERE grantee IN ('anon','PUBLIC');
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants WHERE grantee IN ('anon','PUBLIC');
```

Diff the output against §2. **Especially check for grants to `PUBLIC`** —
revoking from `anon` is useless if SELECT was granted to `PUBLIC`. Write 049
against what is actually there; report any surprise before proceeding.

## 5. Migration hygiene

- **Precondition-guarded:** open with a `DO` block that `RAISE EXCEPTION`s if
  any policy 049 expects to drop does not exist, and if any RPC it depends on
  (`get_public_receipt`, `get_storefront_owner_phone`) is missing or not
  executable by anon. Staging/prod drift must explode at apply time, not
  diverge silently.
- Single transaction (one migration file — default behavior).
- No app code changes. Zero `src/` diff. The storefront loader and receipt UI
  are already compatible.

## 6. Verification matrix (staging, raw anon client)

**Must still WORK (allow):**
1. Storefront products query — the exact select string from
   `storefrontCatalogQueries.ts`, including the inventory embed → rows.
2. Storefront shop query — exact select from `storefrontShopQueries.ts` → row.
3. `rpc('get_storefront_owner_phone', {p_shop_id})` → phone.
4. `rpc('get_public_receipt', {p_invoice_id})` → full receipt JSON.
5. Browser smoke: storefront page (all data renders) + receipt page. This is
   the one justified browser check — 049 changes live public-boundary behavior.

**Must now FAIL loudly / return nothing (deny):**
6. `anon: SELECT gstin FROM shops` → permission denied (column not granted).
7. `anon: SELECT purchase_price_paise FROM products` → permission denied.
8. `anon: SELECT * FROM invoices` → permission denied (grant revoked).
9. `anon: SELECT * FROM invoice_items` → permission denied.
10. `anon: SELECT * FROM users` → permission denied.
11. `anon: SELECT phone FROM users` → permission denied. (Single-column probe —
    catches grant-vs-policy mistakes that `SELECT *` can mask.)

The RPCs are SECURITY DEFINER and immune to anon revokes — that is why steps
3–4 must pass unchanged.

## 7. Invariants

1. Only the `anon` role's read surface changes. `authenticated`, RLS for shop
   members, service role, and all RPC behavior are untouched.
2. Checkout is out of scope: `create_online_order` is already revoked from
   anon (033/034/039) and runs server-side via `/api/storefront/checkout`.
3. No behavior, copy, payload, or route changes. This is a permissions-only
   contract migration.

## 8. Rollout

Production is at pre-hardening `8c38909` with **none** of 042–049 applied.
The rollout applies migrations 036–049 **together with** the integration app
deploy in the one approved staged-then-prod pass (per `CODEX_BRIEF.md`). There
is no intermediate window: the deployed app already uses the RPCs, and there
are no real users. 049 is the last migration in that stack.

## 9. Accepted residual risk (recorded, not hidden)

- **Shop enumeration:** `shops` keeps `USING(true)`, so anon can still *list*
  all shops' granted columns (business name, city, theme) rather than only
  fetch by ID. After column locks this is business-directory-grade data.
  Closing it fully requires a pure-RPC storefront loader (app change).
- **Inventory enumeration:** same shape — platform-wide stock counts readable.
  No cost data.
- Both are accepted for launch; the follow-up that closes them is below.

## 10. Explicitly deferred (decisions for Darshan, separate from 049)

1. **Migration 018 storage policy "Public read customer images"** — anon-readable
   customer-images bucket (khata customer photos). Privacy/DPDP call: lock down
   in the launch pass or accept. Storage policy, not table RLS — separate change.
2. **Full-RPC storefront** — replace the two remaining direct anon table reads
   with curated RPCs (`get_storefront_shop`, `get_storefront_catalog`) and
   revoke all anon table access. Strongest end state; app change; natural
   follow-up after 049, before or alongside the design reskin.
