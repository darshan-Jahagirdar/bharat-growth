# Manual Regression Checklist

Use dedicated staging users and synthetic data. Record tester, date, exact
commit/deployment, environment, fixture IDs/tags, evidence, mutations, and
cleanup readback. This complements the full behavior inventory; it does not
authorize production or external messaging.

## Authentication, onboarding, and tenancy

- [ ] Phone OTP succeeds with current India formatting, six-cell entry,
  paste/backspace/Enter, resend, and correct `next`/onboarding redirect.
- [ ] Email magic link and `/auth/callback` succeed with the correct redirect.
- [ ] Authenticated users are kept out of `/login`; unauthenticated users cannot
  open protected routes.
- [ ] Onboarding validates business name/pincode/state, creates one shop/owner,
  seeds inactive campaigns, and does not leave an orphan on failure.
- [ ] A user cannot read or mutate another shop through UI, API, RPC, or direct
  client calls.
- [ ] Known development credentials fail against production at the final gate.
- [ ] TopNav routes and logout remain exact.

## Billing, customer, tax, payment, stock, and credit

- [ ] Customer and product search debounce/stale-response behavior matches the
  baseline; name/phone/SKU/HSN/barcode paths work.
- [ ] Customer create/select/clear, GSTIN, image, consent log, loyalty, khata
  balance, and repayment actions work.
- [ ] F2/F3/F4/F5/F8, row navigation, Escape, Enter focus, barcode scanner,
  modal lock, clear, and print match the baseline.
- [ ] Duplicate product increments the row; fractional quantity and removal work.
- [ ] GST 0/5/12/18/28, CGST/SGST, IGST, composition Bill of Supply, rounding,
  invoice numbering, IST date, and financial year match the baseline.
- [ ] Cash, UPI, card, and credit preserve totals and payloads; UPI uses the
  modal-captured amount and confirmation occurs before save.
- [ ] Walk-in/customer sales, receipt send, low-stock alert, and Sales Order
  reserve preserve action ordering.
- [ ] POS negative stock remains allowed; online acceptance remains strict.
- [ ] Khata sale, valid repayment, rejected overpayment, and concurrent repayment
  reconcile with the ledger.
- [ ] Loyalty points/running balance remain correct through customer changes and
  khata sales.
- [ ] Pending online-order polling/Realtime, accept/reject, strict stock, and
  print behavior work.

## Products and inventory

- [ ] Product create/edit/search and form hydration preserve rupee/paise values,
  SKU, HSN, barcode, category, unit, GST, stock tracking/threshold, active state,
  vertical attributes, and payload scope.
- [ ] Image type validation/upload/replacement and errors match.
- [ ] Existing and inline-created Bring-Back tags select correctly.
- [ ] Stock-in/out adjustment preserves reason, current quantity, tenant RPC,
  success/error, and low/zero badges.
- [ ] CSV template, parsing, valid/invalid preview, GST validation, and valid-row
  insertion match.

## Purchases and orders

- [ ] New Purchase resolves shop/quota; supplier/bill/date fields and validation
  work.
- [ ] Speed grid product search, row shape, quantity/cost/GST/total, add/remove,
  Enter/Tab/F10 focus and validation match.
- [ ] AI scan file validation, quota, one-query matching, exact/two-word/unmatched
  mapping, feedback, and hard-stop errors match using an approved fixture.
- [ ] Atomic purchase bill preserves paise payload and receives stock; skipped
  rows/reporting and reset match.
- [ ] Draft PO preserves payload and makes no stock change.
- [ ] Purchase History latest-100 ordering, item counts, lazy expansion, fallback,
  empty/error states, and totals match.
- [ ] Sales Orders load first and POs lazy-load; tabs, expansion, status labels,
  Load More offsets, and toast states match.
- [ ] Sales/PO WhatsApp messages, phone/content/total/storefront link match.
- [ ] Guarded cancellation confirmation and tenant arguments match; fulfilled or
  cancelled orders cannot be cancelled.
- [ ] SO payment selection/conversion and PO receive conversion preserve RPCs,
  fractional quantities, composition behavior, status, stock, and refresh.

## Dashboard and progress

- [ ] Default month, Today, Last 7 Days, This Month, and Custom use exact IST
  boundaries and fallback.
- [ ] KPI/progress cards, revenue/top-product charts, units/colors/tooltips, and
  empty/loading states match.
- [ ] Storefront link and current-month GST CSV rows, alerts, and sanitized
  filename match.
- [ ] Khata hitlist/reminder dialog and exact `{ customer_id }` request match. Do
  not invoke a live provider without explicit approval.
- [ ] Low-stock and negative-stock anomaly lists match.
- [ ] “Log Missing Delivery” uses the same stock RPC and refresh behavior.
- [ ] Retention ROI values and empty state match.
- [ ] `/progress` milestone grouping, state cycling, localStorage persistence,
  momentum, and reset remain local-only.

## Campaigns and WhatsApp

- [ ] Recommended campaigns seed inactive and retrofit without duplicates.
- [ ] Rule timing/tag/template/custom variable, toggle, Enable All, stats, and ROI
  output match.
- [ ] Only marketing-consented customers match; optional marketing consent never
  gates storefront order-data consent.
- [ ] Daily cap, claim/dedup, send classification, release, and retry behavior
  pass in simulation/approved staging.
- [ ] Cron without correct Bearer authorization is rejected; secret is not in a
  URL or output.
- [ ] Receipt/khata/system-alert routes reject cross-shop, missing, invalid, and
  ineligible records.
- [ ] Webhook verification/signature handling and STOP-equivalent consent
  revocation work with approved synthetic payloads.

## Storefront Wave 6 matrix

- [ ] Invalid UUID, loading, not found, product-query warning, and fatal error
  states match.
- [ ] Public shop/product mapping exposes only expected fields; tracked missing
  inventory is zero and untracked stock is unlimited.
- [ ] Modern, Industrial, and Festive dispatch and full copy/visual output match.
- [ ] Industrial/Festive category grouping, placeholders/images, unit/price,
  conditional owner contact, and per-product WhatsApp message match.
- [ ] Modern shop header, logo/initial, city, sorted category pills, name/category
  search, clear, placeholder, image/unit/price, and empty state match.
- [ ] Modern tracked zero stock cannot be added; cart clamps at stock with toast;
  untracked products remain addable.
- [ ] Cart add/increment/decrement/removal, count, total, floating bar, drawer,
  backdrop/close, and scroll lock match.
- [ ] Checkout requires name/phone/order-data consent, keeps address optional,
  keeps marketing optional, and preserves UPI/Khata selection/disabled states.
- [ ] Exact checkout payload/item order and per-attempt idempotency reuse match.
- [ ] Network/non-2xx error shows the same error and never navigates to WhatsApp.
- [ ] If an order mutation is explicitly approved, server-confirmed order/total,
  success clearing, key retirement, and same-tab WhatsApp message match; clean
  the synthetic order/customer/consent/stock effects and verify cleanup.
- [ ] Missing owner contact shows the same disabled final state.

## Public receipt

- [ ] Invalid/not-found/error/loading states and no-index header match.
- [ ] Shop/customer/item/order, date/time, GST/composition, discount/round-off,
  total/payment, print, share, and mobile layout match.
- [ ] During Wave 6, record the current compatibility-policy behavior without
  changing it. At the later migration 049 gate, direct anonymous invoice/user
  table reads are denied while constrained Receipt/Storefront behavior remains
  functional.

## Visual and release evidence

- [ ] Integration and candidate captures use the same exact application base,
  deployment isolation, fixture, browser, viewport, route, data, and UI state.
- [ ] Pixel/byte comparison and DOM/copy checks show no decomposition drift.
- [ ] Browser console and Vercel runtime error-level logs show no blocking error.
- [ ] Temporary Auth/profile/data/session/variable/deployment/evidence artifacts
  are enumerated, removed, and verified absent/restored.
- [ ] GitHub exact head/base/checks, Supabase exact target/migrations, and Vercel
  exact commit/state are recorded.
- [ ] Repository docs, Google handoff readback, and `#bharatgrowth` milestone
  contain the actual result and next gate.
- [ ] Production remains unchanged unless the separate final rollout was
  explicitly approved and completed.
