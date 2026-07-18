# BharatGrowth Feature and Behavior Inventory

Last source verification: 2026-07-18 (Asia/Kolkata), Wave 7 integration
checkpoint `053abca608bfa9e3d95c847b8a9481c847c3a76f`, merged only into
integration. Production remains `8c38909`.

This is the product map for behavior-preserving engineering work. It explains
what BharatGrowth is, why each current surface exists, and what a decomposition
must not change. It is not a claim that every roadmap or landing-page promise is
already sale-ready.

## 1. Product identity

BharatGrowth is a multi-tenant vertical SaaS application for single-store
Indian SMBs, initially tyre shops, sweet stalls, garment stores, and general
retail. Its operating wedge is fast desktop billing. Its intended retention
moat is consent-aware WhatsApp receipts, khata reminders, and repurchase-cycle
campaigns. The current app also connects product/catalog, inventory, purchasing,
orders, GST reporting, a public storefront, receipts, and owner analytics around
the same shop.

The primary user is an owner or staff member serving roughly 20–200 bills per
day. That is why the protected workspace is desktop- and keyboard-oriented,
while storefront and receipt surfaces are public and mobile-oriented.

The tenant boundary is `shops.id` / `shop_id`, not a generic undocumented
`tenant_id`. Money crossing application, API, RPC, or database boundaries is
integer paise. Database timestamps are UTC and date/financial-year behavior is
interpreted in IST where documented.

## 2. Truth labels

- **Implemented:** source-backed behavior on the current integration commit.
  Preserve it during decomposition unless Darshan approves a separate fix or
  feature PR.
- **Staging-proven:** implemented behavior for which the engineering record also
  contains staging evidence. This does not make it a production release.
- **External gate:** implemented code depends on provider configuration or
  approval outside the repository.
- **Planned:** roadmap, positioning, or follow-up work that must not be invented
  inside a decomposition.

Landing-page language expresses product positioning. It is a copy and visual
contract during decomposition, but it is not proof that the underlying provider
or sale-readiness gate is complete.

## 3. Global preservation contract

Every decomposition wave preserves:

- routes, redirects, query parameters, public URLs, exported interfaces, API
  request/response shapes, RPC arguments, and database payload ordering;
- copy, labels, icons, colors, spacing, responsive behavior, DOM-visible output,
  print output, screenshots, and theme selection;
- focus movement, keyboard shortcuts, scanner timing, modal locks, button enable
  rules, confirmations, browser navigation, and async error/success ordering;
- tenant derivation, RLS assumptions, public/private data boundaries, consent,
  stock rules, GST rules, paise rounding, IST ranges, and financial-year rules;
- loading, empty, error, retry, and cleanup behavior;
- deliberate asymmetries, especially POS negative stock versus storefront and
  online-order strict stock.

Waves 1–6 used characterization first, pure transforms second,
controllers/hooks third, and focused views last. Wave 7 characterized exact
query shape before splitting implementation by use case behind stable facades.
A decomposition is not permission to repair an inherited behavior.

## 4. Routes and access model

| Route or surface | Why it exists | Current behavior to preserve |
|---|---|---|
| `/` | Product positioning and conversion | Existing Spline visuals, copy, sections, CTAs, pricing/benefit claims, and responsive output. |
| `/login` | Shop-user authentication | Phone OTP and email magic-link tabs; `next` redirect; six-digit OTP entry, paste, backspace, auto-advance, and Enter behavior. Phone UI visibly shows `+91`; committed Auth sends `91XXXXXXXXXX` without a literal plus. |
| `/auth/callback` | Completes email/magic-link auth | Exchanges the callback code and returns to the validated destination. Root `?code=` is redirected here by middleware. |
| `/onboarding` | Creates the first shop and owner membership | Auth required; business profile, pincode/state resolution, shop creation, owner row creation, rollback/retry behavior, and inactive default campaign seeding. |
| `/billing` | High-speed point of sale | Protected desktop billing workspace and the behavior detailed below. |
| `/dashboard` | Owner operating view | Protected analytics, GST export, khata, stock, and retention actions. |
| `/dashboard/products` | Catalog and stock maintenance | Protected product CRUD, images, tags, bulk import, and stock adjustment. |
| `/dashboard/purchases/new` | Fast supplier-bill intake | Protected speed grid, AI scan assist, stock-receiving bill, and draft PO paths. |
| `/dashboard/purchases/history` | Purchase audit trail | Protected latest-100 bills with lazy expandable stock-movement detail. |
| `/dashboard/orders` | Reservation and procurement lifecycle | Protected Sales/Purchase Order tabs, sharing, cancellation, conversion, and pagination. |
| `/dashboard/campaigns` | Retention automation control | Protected campaign rules, opt-in posture, activation, and ROI statistics. |
| `/settings` | Shop tax configuration | Protected business/GST settings and validation. |
| `/store/[shop_id]` | Customer-facing catalog and ordering | Public, shop-scoped catalog with selected theme; Modern includes strict-stock cart and checkout. |
| `/receipt/[id]` | Customer digital receipt | Public UUID-scoped receipt with print/share actions and no indexation. |
| `/progress` | Local product-build tracker | Separate localStorage-backed milestone tracker; it is not shop analytics or server business data. |

Middleware protects `/billing`, `/dashboard`, and `/onboarding`, redirects an
unauthenticated request to `/login?next=...`, redirects an authenticated login
visit to `/billing`, and deliberately leaves API, storefront, and static routes
to their own boundaries.

## 5. Authentication, onboarding, navigation, and settings

### Authentication

Why: identify a person before resolving their shop membership without putting
application credentials in the client.

Preserve:

- phone and email tabs, current labels/copy, error display, and redirect rules;
- the visible `+91` prefix, ten-digit input limit, and current
  `useAuth.sendOtp` normalization to `91XXXXXXXXXX` without a literal plus;
- six OTP cells, digit-only handling, full-code paste, forward focus, Backspace
  movement, Enter submit, resend, and loading/disabled states;
- email magic link callback URL and onboarding-versus-billing routing;
- no committed dev-login backdoor.

Known non-product workaround: a temporary raw-ten-digit staging login variant
was used only to access a hosted Supabase test phone. It was never committed,
pushed, or applied to production and is not a behavior to carry forward.
Provider/auth redesign is deferred to dedicated auth/payment-gateway work.

### Onboarding

Why: create the shop tenant and bind the authenticated owner once.

Preserve:

- business types `tyre_shop`, `sweet_stall`, `garment_store`, and `general`;
- required business name and pincode flow;
- India Post pincode lookup, city autofill, GST state-code mapping, and manual
  state fallback;
- server-side authenticated user validation;
- shop then owner membership creation, retry/backoff for membership visibility,
  and orphan-shop rollback if ownership cannot be established;
- default shop flags and inactive recommended campaign seeding;
- onboarding success redirect and current errors.

### Navigation and settings

Why: give shop staff a stable operational route map and owners a place to set
tax identity.

Preserve the TopNav destinations and order: Billing, Dashboard, Products, New
Purchase, Purchase Log, Orders, Campaigns, Settings, and Logout. Preserve shop
membership resolution, GSTIN format/checksum validation, state code, regular
versus composition GST type, and existing tax-setting payloads.

## 6. Billing / point of sale

Why: the core wedge is completing an accurate bill quickly at a crowded retail
counter.

### Shop and customer context

Preserve:

- authenticated shop resolution, shop GST type/state, UPI ID/name, and pending
  online-order context;
- customer search by phone/name after the existing debounce threshold; no query
  under two characters and no stale response replacing a newer query;
- selected-customer snapshot, lazy loyalty loading, credit balance, GSTIN,
  customer photo, explicit marketing consent, and consent log;
- inline customer creation with current validation and payload;
- clear-customer, credit-repayment entry point, and post-action refresh behavior;
- walk-in sales with null customer fields and no loyalty entry.

### Product entry and speed controls

Preserve:

- product search by name, SKU, HSN, and barcode with its faster debounce and
  stale-response guard;
- rapid barcode buffering and Enter detection, including the minimum buffer
  length;
- adding the same product increments the existing row instead of duplicating it;
- active row, quantity and removal controls, fractional quantities, selected
  search result, and all focus transitions;
- global F2 customer, F3 product, F4 clear, F5 save/print, and F8 payment-mode
  cycle behavior even when focus is inside an input;
- row navigation/quantity shortcuts staying out of text inputs; Escape blurs an
  input; all shortcuts stop while billing interaction is locked;
- header document type, pending-order control, footer shortcut legend, totals,
  payment mode, and all footer actions.

### Money, GST, payment, and saving

Preserve:

- integer-paise calculations and rounding per line;
- GST slabs 0, 5, 12, 18, and 28; CGST/SGST split for intra-state; IGST for
  inter-state; rounding-remainder handling; composition Bill of Supply with no
  tax; and unchanged grand total when tax representation changes;
- current line/invoice discount fields and clamping logic, but no new discount
  UX or rules;
- cash, UPI, card, and credit payment modes and their current cycle/order;
- amount-locked UPI QR and explicit confirmation before save;
- invoice validation, item order, customer snapshot, document type, date,
  invoice numbering, and exact `save_invoice` RPC payload;
- atomic invoice/item/stock/credit effects, result handling, receipt sending,
  iframe print, clear-after-success, and demo fallback behavior;
- loyalty points earned from final total at sale time, including khata sales,
  with prior running balance preserved;
- POS stock may go negative intentionally; low-stock owner alert behavior stays
  unchanged.

### Khata, sales reservations, and online orders

Preserve:

- credit sale ledger behavior, atomic repayment, overpayment rejection, and
  balance refresh;
- Reserve Sales Order payload, non-product row filtering, computed quantity,
  and absence of new conversion-time loyalty/campaign attribution;
- pending online-order polling plus Realtime refresh;
- accept/reject drawer states, strict server stock on acceptance, invoice/print
  behavior, and no weakening of storefront/online-order stock rules.

## 7. Products, inventory, tags, and bulk import

Why: billing speed and storefront accuracy depend on a maintainable catalog and
auditable stock.

Preserve:

- shop-scoped loading of active products, inventory quantities, and campaign
  tags;
- search across name, SKU, HSN, barcode, and category;
- create/edit hydration and payloads for name, SKU, HSN, barcode, selling and
  purchase prices, unit, category, GST rate, stock tracking, low-stock threshold,
  image URL, vertical attributes, active state, and campaign tag;
- rupee-string to paise conversion and integer-paise rounding;
- product image file-type validation, upload/replace flow, preview, and current
  error behavior;
- inline creation and immediate selection of a Bring-Back campaign tag;
- stock badges, zero/low-stock color rules, edit and adjustment controls;
- stock-in/stock-out adjustment, reason, current quantity, and tenant-scoped
  `adjust_stock` RPC arguments;
- bulk CSV template/download, parsing, preview, valid/invalid rows, validation of
  required name/price and permitted GST rates, and inserting only valid rows;
- existing success/error/loading/empty copy and visual output.

## 8. Purchases and procurement intake

Why: receive supplier stock quickly while recording cost and preserving the
option to prepare an order before stock arrives.

### New purchase bill

Preserve:

- authenticated shop and scan-quota loading;
- supplier name, optional bill number, IST-default bill date, and validation;
- speed-grid empty-row shape, product search scoped to the active shop, selected
  versus saveable row distinction, quantity, purchase price, GST, line total,
  row add/remove, and Enter/Tab focus behavior;
- F10 save shortcut and its validation ordering;
- paise totals, skipped incomplete-row count, and exact atomic
  `save_purchase_bill` RPC payload;
- a successful bill creates purchase stock movements through the RPC and resets
  the form with existing feedback timing;
- Save as Purchase Order creates the exact draft PO payload and explicitly does
  not change stock until received;
- AI scan file type/size validation, quota display, multipart request, one
  catalog query, exact-name and leading-two-word mapping, no one-word false
  positives, matched/unmatched merge behavior, and feedback copy;
- scan and save errors are hard stops; they must not silently proceed.

### Purchase history

Preserve:

- latest 100 bills ordered newest first;
- supplier, bill number, bill date, item count, and paise total formatting;
- click-to-expand lazy loading of purchase inventory movements;
- nested product-name/unit join with the existing fallback query;
- loading, empty, no-items, and New Purchase link behavior.

## 9. Sales and purchase orders

Why: separate intent/reservation from final invoice or stock receipt.

Preserve:

- Sales Orders load first; Purchase Orders lazy-load on first tab switch;
- 50-row pages and Load More offset based on current list length;
- Sales statuses draft/reserved/fulfilled/cancelled and Purchase statuses
  draft/sent/fulfilled/cancelled with current labels, colors, and actionable
  rules;
- expansion of headers/items/totals and current date/phone formatting;
- Sales Order WhatsApp content, normalized Indian number, item totals, and
  storefront link;
- Purchase Order WhatsApp supplier, items, and estimated-total content;
- Sales conversion dialog and cash/UPI/credit/card payment selection;
- `convert_so_to_invoice` and `convert_po_to_bill` RPC arguments, success
  messages, refresh, and close behavior;
- conversion of a PO receives stock; draft PO creation did not;
- exact cancellation confirmation copy, tenant arguments, backend status guards,
  and inability to cancel fulfilled/cancelled orders;
- toast timing and all loading/disabled states.

## 10. Dashboard, reporting, and local progress

Why: show the owner what happened, what is owed, what needs stock action, and
whether retention automation is producing revenue.

Preserve:

- default This Month range and exact IST Today, Last 7 Days, This Month, and
  Custom timestamp boundaries/fallback;
- KPI/progress cards and their labels, including revenue, bills, khata owed,
  stock-in/current stock value, and other query-provided metrics;
- revenue trend and top-product chart series, colors, units, totals, empty
  states, and tooltip output;
- storefront link and selected-period loading behavior;
- current-month GST CSV row order/content, shop-name filename sanitization,
  alerts, and success state;
- khata hitlist, confirmation dialog, protected reminder endpoint, exact
  `{ customer_id }` payload, simulation/provider result handling, and success
  toast;
- low-stock list and negative-stock anomaly list;
- “Log Missing Delivery” reconciliation, exact `adjust_stock` payload, modal
  state, and the existing refresh behavior after success;
- retention ROI card values from active campaign rules, sent/returned customers,
  and attributed revenue;
- `dashboardQueries.ts` remains the compatibility export surface after Wave 7;
  its focused implementation modules preserve the characterized query behavior.

The `/progress` route is intentionally different: it groups local product-build
milestones into foundation/core/retention/growth/scale, cycles milestone state,
calculates week/month momentum, persists to its existing localStorage key, and
supports reset. It must not be rewritten as server-backed shop analytics during
decomposition.

## 11. Campaigns, WhatsApp, and consent

Why: bring consented customers back at a sensible repurchase interval without
endangering the shared WhatsApp sender.

Preserve:

- recommended rules by business type are seeded inactive by default; older shops
  can retrofit them from the campaigns page;
- rules retain tag, trigger days, template key, custom variable limit, active
  toggle, Enable All, timing labels, and per-rule/aggregate ROI statistics;
- only customers with explicit marketing consent are campaign eligible;
- matching remains in the database RPC, with daily send cap, claim-before-send,
  duplicate protection, definite rejection handling, ambiguous provider result
  handling, and claim release where required;
- cron authorization remains Bearer-secret based; missing/incorrect authorization
  is rejected and no secret goes in a URL or log;
- WhatsApp service simulation mode and live-provider result classification;
- registered internal template keys and variable order for receipt, khata,
  low-stock/system alerts, restock, new-arrival, and promo messages;
- receipt endpoint is authenticated, tenant-scoped, completed-invoice-only, and
  requires a customer phone;
- khata endpoint is authenticated, tenant-scoped, and requires positive credit;
- system alert endpoint resolves a tenant-owned product and shop-owner phone;
- webhook GET verification, POST HMAC verification where configured, masked
  logging, always-200 handling after verified intake, and STOP/Hindi-equivalent
  revocation of marketing consent across shops for the shared sender.

External gates remain: Meta app/webhook configuration, approved production
templates, provider credentials, opt-out wording approval, and operational
monitoring. Do not claim these are complete based only on source code.

## 12. Storefront and checkout

Why: let a shop publish a safe catalog and turn browsing into an order/WhatsApp
conversation without exposing private shop data.

### Loader and public boundary

Preserve:

- UUID route validation and generated metadata;
- the browser loader selects only its listed shop identity/theme fields, active
  product fields, and owner phone, but currently relies on the temporary
  anonymous table policies from migrations 013/014; the server query module also
  contains a constrained owner-phone RPC path;
- active product fields only, category/name sort order, inventory join, and
  tracked-product stock mapping;
- tracked products with no inventory are treated as zero in the client loader;
  untracked products use unlimited/null stock semantics;
- document title, loading, 404, error, and non-fatal product/contact behavior;
- exact theme dispatch: `modern` default, `industrial`, and `festive`.

### Industrial and Festive themes

Preserve their category grouping, category fallback labels, logos/placeholders,
vertical visual language, product fields, price/unit formatting, owner-contact
conditional, per-product “Buy on WhatsApp” link, prefilled message, and footer.
They are not to inherit Modern cart/checkout behavior accidentally.

### Modern theme

Preserve:

- sticky shop header, logo/initial fallback, city, search clear control, and
  horizontally scrollable sorted category pills;
- search by product name/category combined with the active category;
- two-column mobile catalog, deterministic placeholder colors/initial, image,
  unit, price, empty state, and exact card output;
- strict stock: out-of-stock tracked items cannot enter the cart; quantity is
  clamped to current stock; the stock-limit toast and plus-button state remain;
- Map-backed cart semantics, item count, paise total, decrement/removal, floating
  cart bar, checkout drawer, backdrop/close behavior, and body scroll lock;
- required name and phone, optional address, phone max length, UPI versus Khata,
  required order-data consent, optional marketing consent that never gates an
  order, error display, and disabled/submitting states;
- per-attempt UUID idempotency key reused across retries and cleared only after
  success;
- exact checkout API payload and maximum item/quantity constraints;
- server RPC is authoritative for shop/product/price/stock/order creation; the
  client total is not trusted;
- network/non-2xx errors are hard stops and must not open WhatsApp;
- successful order clears state and navigates the same tab to a normalized
  owner WhatsApp URL with confirmed order number/total and current message text;
- missing shop contact disables the final handoff.

No copy, layout, theme unification, animation, stock, cart, consent, payload,
WhatsApp, or browser-navigation change belongs in Wave 6.

## 13. Public digital receipt

Why: give the customer a lightweight receipt link that can be sent on WhatsApp
without exposing invoice tables.

Preserve:

- UUID validation, public `get_public_receipt` RPC, loading/not-found/error
  states, document title, and `X-Robots-Tag: noindex`;
- shop identity/GSTIN/city/phone, invoice number/date/time, customer snapshot,
  item order/quantity/rate/GST, subtotal, CGST/SGST versus IGST, discount,
  round-off, final total, tax-inclusive note, and payment icon/label;
- composition/tax-invoice display rules;
- browser print and Web Share behavior plus existing fallback;
- mobile layout, copy, and “Powered by BharatGrowth” footer.

## 14. Database, security, and transactional invariants

Why: the app combines money, customer data, stock, and outbound messaging; UI
checks alone are insufficient.

Preserve:

- migrations are ordered and immutable once applied; current staging history is
  continuous 001–048;
- authenticated shop membership and RLS are the protected-data boundary;
- server routes derive/verify the active shop rather than trusting a browser
  tenant id;
- the Receipt UI uses `get_public_receipt`; `get_storefront_owner_phone` also
  exists, while the current browser Storefront loader still depends on the
  additive compatibility policies;
- tenant guard, `search_path`, function ownership, grants, and current anonymous
  policy behavior must stay understood and tested;
- migrations 013/014 still grant the legacy anonymous compatibility reads.
  Migration 042 did not remove them. Migration 049 must wait until every public
  consumer is compatible with the constrained path;
- atomic invoice, purchase bill, online order, SO/PO conversion, credit
  repayment, stock adjustment, loyalty balance, and AI quota behavior;
- online checkout idempotency and strict stock; POS negative stock remains
  allowed;
- no migration, RLS, grant, policy, function signature, or schema change inside
  Waves 1–7.

## 15. Current automated coverage

At Wave 7 integration checkpoint `053abca`, 140 tests across 28 files pass
together with strict typecheck, zero-warning lint, and the 25-route optimized
build. Characterization covers Billing, Orders, Products, Dashboard, Purchases,
Storefront loader/theme output, Modern catalog/cart/checkout, validators,
campaign defaults, date behavior, migration safety, and exact Billing/Orders/
Dashboard/Storefront query shape. The 24 data-access tests pin select strings,
filters and arguments, sorting/null behavior, limits/ranges, RPC names and full
arguments, client/table/call sequence, errors, fallbacks, and result mapping;
row-result-only assertions are not an adequate replacement.

## 16. Planned or externally incomplete—not current decomposition work

These items may be important for sale-readiness, but must not be added or
represented as complete inside a decomposition:

- Razorpay subscription billing, plans, payment gateway, and WhatsApp-credit
  packs;
- production-ready auth/provider redesign beyond the current phone/email flow;
- offline billing/service-worker synchronization;
- full Hindi/English bilingual UI;
- e-invoicing/IRN and a complete Rule 46 PDF/thermal-print program;
- loyalty redemption;
- server-authoritative POS total recomputation;
- a designed discount engine and discount UI;
- production Sentry/error monitoring and verified test event;
- public/messaging rate limiting;
- production Meta templates/webhook/credentials and live campaign launch;
- DPDP erasure/anonymization and full operational compliance program;
- migration 049 contract cleanup and the controlled production rollout;
- broad mobile/admin redesign or visual refresh.

Product roadmap changes require a new decision, behavior contract, tests, and
separate PR. They do not ride along with structural work.
