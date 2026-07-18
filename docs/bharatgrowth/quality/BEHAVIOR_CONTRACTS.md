# Behavior Contracts

These contracts freeze current intentional behavior during decomposition. The
full feature-by-feature rationale and behavior map is
[`../product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](../product/FEATURE_AND_BEHAVIOR_INVENTORY.md).
A change requires a separate decision, characterization update, and feature/fix
PR.

## Structural contract

- Characterize unchanged behavior before application extraction.
- Extract pure transforms first, controllers/hooks second, and focused views
  last.
- Preserve routes, redirects, query parameters, exports, request/response
  shapes, RPC arguments, field/item ordering, loading/error ordering, and public
  URLs.
- Query-facade implementation movement was limited to completed Wave 7 and
  remains frozen behind the original compatibility exports. Any later behavior
  or query change requires a separate approved contract.
- No schema, migration, policy, grant, RLS, function-signature, provider-config,
  or production change belongs in a decomposition.

## Billing, money, and stock

- Monetary API/database values use integer paise; existing per-line rounding and
  total construction remain unchanged.
- GST retains 0/5/12/18/28 slabs, remainder-preserving CGST/SGST split,
  inter-state IGST, composition Bill of Supply, date, and financial-year rules.
- POS may complete a sale with negative inventory; this is intentional.
- Storefront, online checkout, and online-order acceptance reject/clamp
  insufficient tracked stock. Untracked inventory remains unlimited.
- Credit/khata sale and repayment remain tenant-scoped, atomic, and ledger
  consistent; overpayment is rejected.
- Loyalty is earned at sale time, including khata sales, from the final total.
- Sales-order conversion currently does not add campaign attribution or loyalty.
- Discounts remain a product-design follow-up; decomposition must not invent a
  discount UI or rules.
- Server-authoritative POS recomputation remains a separate hardening item.

## Billing interaction

- F2/F3/F4/F5/F8, row navigation, scanner buffering, text-input exclusions,
  Escape blur, focus movement, modal locking, and print/payment ordering stay
  exact.
- Product/customer search debounce thresholds and stale-response protection stay
  exact.
- Adding a duplicate product increments the existing row.
- UPI confirmation uses the amount captured when the modal opens.
- Customer snapshot, consent, loyalty, credit, GSTIN, image, repayment, and
  clear behavior remain connected to the same handlers and payloads.
- Invoice, Sales Order, online-order, receipt, and low-stock follow-up ordering
  remains unchanged.

## Authentication, tenancy, and time

- Phone OTP and email magic link remain supported with current redirects and OTP
  input behavior.
- The phone field visibly renders a `+91` prefix, accepts ten local digits, and
  `useAuth.sendOtp` sends canonical `+91XXXXXXXXXX` E.164 to Supabase. Send,
  verify, and resend reuse that exact request value. Supabase Auth normalizes it
  to `91XXXXXXXXXX` country-code digits for Auth-user and hosted test-OTP lookup;
  the removed raw-ten-digit workaround is not a source contract.
- `shops.id` / `shop_id` is the tenant boundary.
- Protected server routes derive/verify tenant membership server-side; browser
  tenant fields are not authoritative.
- Public storefront and receipt expose only constrained documented shapes.
- Database timestamps remain UTC; invoice dates, dashboard ranges, CSV naming,
  and financial years retain current IST behavior.

## Products, purchases, and orders

- Product form hydration, price conversion, image validation, stock adjustment,
  tags, search, bulk CSV validation, and payloads remain unchanged.
- Purchase grid row shape, Enter/Tab/F10, shop-scoped search, scan validation and
  matching, paise totals, skipped rows, bill RPC, and draft-PO payloads stay
  exact.
- Saving a purchase bill receives stock; creating a draft PO does not.
- Purchase History remains latest-100 with lazy line-item detail and fallback.
- Sales Orders load before Purchase Orders; PO loading remains lazy; pagination
  offsets remain current-list length.
- Status labels/actions, WhatsApp messages, cancellation guards/confirmations,
  and SO/PO conversion RPCs remain unchanged.

## Dashboard and progress

- Today, Last 7 Days, This Month, and Custom retain exact IST boundaries and
  fallback behavior.
- Metrics, chart series/colors/units, empty states, GST CSV rows/filename,
  storefront link, khata reminder payload, stock reconciliation RPC/refresh,
  low-stock/anomaly lists, and retention ROI output stay exact.
- `dashboardQueries.ts` remains the compatibility export surface after Wave 7;
  its characterized query shape and client boundary remain exact.
- `/progress` remains the existing localStorage-backed product-build tracker; it
  must not become server-backed business analytics during decomposition.

## Campaigns, WhatsApp, and consent

- Default campaign rules are seeded inactive. Activation is an explicit owner
  action.
- Only marketing-consented customers are eligible; order-data consent and
  optional marketing consent remain separate.
- Trigger timing, tags, templates, custom-variable limit, daily cap, claim and
  duplicate behavior, provider failure classification, and ROI attribution stay
  unchanged.
- Cron authorization remains Bearer-header based. Secrets never appear in URLs,
  docs, or logs.
- Receipt, khata, and system-alert endpoints remain authenticated and
  tenant-scoped with current validation.
- Webhook signature/verification and cross-shop opt-out behavior for the shared
  sender remain unchanged.

## Storefront and checkout

- Loader public fields, sort order, stock mapping, document title, loading/404/
  error states, and theme dispatch remain exact.
- Modern, Industrial, and Festive visual/copy output remains theme-specific.
  Industrial/Festive do not acquire the Modern cart by extraction.
- Modern search/category filtering, placeholder, product cards, strict-stock
  cart, count/total, toast, drawer, scroll lock, fields, UPI/Khata selection,
  consent, errors, and disabled states stay exact.
- The per-attempt idempotency key is reused across retries and retired after
  success.
- Checkout payload/item order and API response contract stay exact; the server
  RPC remains authoritative.
- Network/non-2xx checkout errors are hard stops with no WhatsApp navigation.
  Success clears state and uses same-tab navigation to the exact normalized
  owner WhatsApp message.
- Per-product WhatsApp links and missing-contact behavior remain unchanged.

## Receipt and public output

- Public UUID validation, constrained receipt RPC, loading/not-found/error,
  no-index header, document title, shop/customer/item/tax/payment output, print,
  share, and mobile presentation remain unchanged.
- Copy, styles, icons, spacing, responsive behavior, DOM-visible output, print
  output, and screenshots are release-blocking behavior during decomposition.

## Verification rule

Automated characterization, exact payload assertions, branch-scoped staging
smoke, same-fixture visual comparison, runtime-log inspection, and cleanup
readback all contribute evidence. A passing unit suite alone does not authorize
merge, and a provider-dependent gate is not complete until the external state is
verified.
