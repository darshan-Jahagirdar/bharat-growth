# BharatGrowth — Bug Fix Plan

> Historical detailed audit. Canonical current status and rollout evidence live
> in [`docs/bharatgrowth/quality/BUG_FIX_PLAN.md`](bharatgrowth/quality/BUG_FIX_PLAN.md).

Source: deep code audit (commit `8c38909` + Bring-Back branch), verified against all 41 migrations.
Scope note: three audit items were resolved as **not bugs** by product decision —
discounts (design pending), SO-conversion loyalty/attribution (not required), and
loyalty-on-khata timing (earned at sale, intended). They are excluded below.

Legend: **[BLOCKS]** = breaks build / data integrity / security; **[FIX]** = correctness; **[POLISH]** = UX/robustness.

Implementation status (Codex hardening pass, 2026-07-11): checked items are
implemented in the local codebase and pass TypeScript, ESLint, and production
build checks. Migrations 042-046 still require application and smoke testing on
preview/staging before production rollout.

---

## About this document

**Author:** Claude (Anthropic), running as Claude Code — an AI coding agent — in Darshan's
local BharatGrowth repo. The audit was carried out primarily on the Opus 4.8 model; this plan
was consolidated and written on the Fable 5 model after a mid-session model switch. No human
hand-wrote these findings; they were produced by the agent reading the code.

**What I was asked to do:** go deep into the codebase and find bugs — but understand the
features *first* so that deliberate design decisions are not mis-reported as bugs, and ask the
owner rather than assume whenever something was ambiguous.

**What I did:** read the load-bearing code (billing math, khata/credit, order & purchase RPCs,
storefront, receipts, WhatsApp routes, auth/middleware) and all 41 SQL migrations end-to-end,
built a model of intended behavior, then flagged only genuine defects — cross-checking each one
against later migrations so nothing already-fixed was reported. I cleared several things that
looked wrong but were safe or intentional (e.g. `adjust_stock` is guarded by migrations 028/032;
POS negative inventory and client-supplied totals are documented decisions), and I raised three
ambiguous behaviors as questions instead of guessing. The owner confirmed all three were
intended, so they were dropped. The result is 14 confirmed bugs plus one build-breaking
regression, turned into the phased checklist below. No source code was changed while producing
this plan.

---

## Phase 0 — Build is red (do first, ~5 min)

- [x] **B0 [BLOCKS] `failureKind` typecheck break** — `src/app/api/cron/campaigns/route.ts:154` reads `sendResult.failureKind`, but `WhatsAppResult` in `src/lib/whatsapp/service.ts` has no such field. `tsc`/`build` currently fail and the retry-on-rejection branch never fires.
  - Fix: add `failureKind?: 'rejected' | 'network'` to `WhatsAppResult`; in `sendTemplate`, set `'rejected'` on the `!response.ok` path and `'network'` in the `catch`.
  - Verify: `npx tsc --noEmit` clean; simulate a rejected send → claim row released.

---

## Phase 1 — CRITICAL public-data exposure (before any pilot, ~half day)

Root cause: anon RLS policies use `USING (true)` and blanket table SELECT. The app's own
queries are column-safe, but the anon key ships in the browser bundle — an attacker calls
Supabase REST directly (`?select=*`, no filter). Fix the RLS boundary, not the queries.

New migration `042_public_rls_hardening.sql`.

- [x] **F11 [BLOCKS] invoices + invoice_items — full financial/PII scrape** (`migration 014`). `TO anon USING (true)` exposes every shop's invoices (customer name/phone/GSTIN/total/payment_mode).
  - Fix: `REVOKE SELECT ON invoices, invoice_items FROM anon`. Add `get_public_receipt(p_invoice_id uuid) RETURNS jsonb` (SECURITY DEFINER) returning one invoice + its items + safe shop columns. Repoint `src/app/receipt/[id]/ReceiptLoader.tsx` from direct table selects to `.rpc('get_public_receipt', …)`.
  - Verify (staging): anon `GET /rest/v1/invoices?select=*` → 0 rows / denied; receipt page still loads by UUID.

- [x] **F12 [BLOCKS] shops — GSTIN/PAN/email/phone/UPI/scan-quota leak** (`migration 013`). Rows are meant to be public (storefront), but columns aren't.
  - Fix: keep row policy; `REVOKE SELECT ON shops FROM anon` then `GRANT SELECT (id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color) ON shops TO anon`. (Column grants apply to anon only; the authenticated dashboard policies are untouched.)
  - Verify: anon read of `gstin`/`pan`/`upi_id` → denied; storefront still renders.

- [x] **F14 [BLOCKS] inventory + products — cost price / margin leak** (`migration 021` + products anon policy). `inventory.cost_price_paise` and `products.purchase_price_paise` are readable by anon.
  - Fix: `REVOKE SELECT ON inventory FROM anon` → `GRANT SELECT (id, shop_id, product_id, quantity_in_stock) ON inventory TO anon`. `REVOKE SELECT ON products FROM anon` → `GRANT SELECT (…public catalog cols…, NOT purchase_price_paise) ON products TO anon`.
  - Verify: anon read of `cost_price_paise`/`purchase_price_paise` → denied; storefront stock + catalog still work.

- [x] **F13 [FIX] users — every owner's contact platform-wide** (`migration 013`). anon reads full_name/phone/email/shop_id of all owners, not just the viewed store.
  - Fix (recommended): drop the blanket owner policy; return the storefront owner phone inside `get_public_receipt`/a small `get_storefront_owner_phone(shop_id)` RPC, or at minimum `GRANT SELECT (phone) ON users TO anon` to stop the name/email/shop_id leak. Repoint `getStorefrontShop` in `src/lib/storefront/queries.ts`.
  - Verify: anon `users?select=*` → denied; storefront WhatsApp CTA still resolves owner phone.

---

## Phase 2 — Money & ledger correctness (~half day)

- [x] **F1 [BLOCKS] `processCreditRepayment` non-atomic + silent overpay** (`src/lib/billing/billingQueries.ts:192`). Ledger insert + read-balance + write-balance across 3 round-trips → lost updates vs concurrent khata sale; `Math.max(0, …)` hides overpayment → ledger/balance drift.
  - Fix: new `record_credit_repayment(shop_id, customer_id, amount_paise, notes) RETURNS jsonb` (SECURITY DEFINER, `assert_authenticated_shop`) that validates `amount <= balance`, inserts ledger, and decrements balance in one transaction. Repoint the function.
  - Verify: overpay attempt rejected; concurrent sale + repayment leaves ledger == balance.

- [x] **F8 [BLOCKS] SO→invoice truncates fractional qty to ₹0** (`migration 030:369`). `agreed_price_paise * v_item.quantity::bigint` rounds 0.5→0, so a 0.5 kg sweet SO bills ₹0 while stock still deducts 0.5.
  - Fix: `ROUND(agreed_price_paise * quantity)::bigint` on numeric (mirror `create_online_order`). New migration `043_fix_so_conversion.sql`.
  - Verify: 0.5-unit SO → correct taxable + total; invoice value matches stock movement.

- [x] **F9 [BLOCKS] SO→invoice ignores composition GST** (`migration 030:325`). Hardcodes `tax_invoice` + always splits CGST/SGST → composition shop issues an illegal tax invoice with tax.
  - Fix (same migration 043): read `shops.gst_type`; if composition → `document_type='bill_of_supply'`, zero the tax, no CGST/SGST. Mirror `create_online_order`'s branch.
  - Verify: composition-shop SO conversion → bill_of_supply, tax = 0.

- [ ] **F10 [POLISH] SO→invoice always intra-state** (`migration 030:331`). `is_inter_state=false` hardcoded → genuine inter-state SO mis-taxed. Bundle into migration 043 if cheap (compare buyer vs shop state); otherwise defer — rare for these verticals.
  - Deferred: `sales_orders` currently stores no buyer state, so the app cannot infer inter-state tax correctly without a schema and UX decision.

---

## Phase 3 — Races & date logic (~2 hrs, frontend)

- [x] **F2 [FIX] Lazy loyalty fetch races onto wrong customer** (`src/app/billing/page.tsx:236`). Async loyalty load calls `setCustomer` off a stale closure → selecting B before A resolves overwrites B; saving before it resolves writes `running_balance` as `0 + earned`, clobbering the true balance.
  - Fix: guard the async result against the currently-selected customer id (ignore if changed); block/warn save until loyalty resolved, or read balance server-side in `save_invoice` instead of trusting client `running_balance`.
  - Verify: rapid A→B selection keeps B's points; save mid-fetch doesn't zero the balance.

- [x] **F3 [FIX] Invoice date uses UTC, not IST** (`src/app/billing/page.tsx:327`, `validateInvoice.ts:71`). `new Date().toISOString().split('T')[0]` → bills 00:00–05:30 IST get the previous day; on Apr 1 the previous financial year (drives invoice numbering).
  - Fix: compute the date in IST (reuse the dashboard IST helper pattern).
  - Verify: a bill at 01:00 IST on Apr 1 lands in the correct FY.

---

## Phase 4 — Low severity polish (~2 hrs)

- [x] **F4 [POLISH] Demo mode can't save** — empty `shopId` fails `invoiceCreateSchema` uuid before the mock branch (`billing/page.tsx`). Skip shop_id validation in DEMO_MODE, or drop demo save.
- [x] **F5 [POLISH] Search breaks on `,`/`(`/`)`** — user input interpolated into PostgREST `.or()` (`billingQueries.ts:35,86`). Sanitize/escape or split into separate `.ilike` calls.
- [x] **F6 [POLISH] UPI modal stale amount + live F-keys** — deferred save closes over a stale bill while F4/F8/barcode stay active during the modal (`billing/page.tsx`). Gate shortcuts while any modal is open; snapshot the total at modal-open.
- [x] **F7 [POLISH] RepaymentModal keeps prior amount after cancel** (`RepaymentModal.tsx`) — reset `amountStr` on cancel/close.

---

## Additional production hardening completed

- [x] AI bill scanning now verifies the authenticated shop with `getUser()`-backed context instead of trusting `getSession()`.
- [x] AI scan quota consumption is atomic and cannot go negative under concurrent requests.
- [x] AI image uploads enforce supported MIME types and a 5 MB limit before provider calls.
- [x] Loyalty running balances are computed under a database lock; stale client state can no longer corrupt the ledger.
- [x] Customer/product async search results ignore stale in-flight responses.
- [x] React image warnings, dead code, and modal semantics were cleaned up; ESLint is warning-free.

---

## Deferred (product decision — not scheduled)

- Discount engine: `calculateTotals`/store/DB support it, no UI wired. When built, clamp negative line discounts and cap invoice discount ≤ total.
- SO conversion loyalty + attribution: intentionally omitted (SO is a quote).

---

## Suggested execution order
0 → 1 → 2 → 3 → 4. Phases 0–1 are the release blockers; 2 is next-most-important
(real rupee/ledger errors); 3–4 are quality. Each phase ends green on
`tsc` + `lint` + `build`, and Phase 1/2 migrations get applied to preview/staging
and smoke-tested before production.
