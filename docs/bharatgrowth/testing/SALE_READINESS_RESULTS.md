# BharatGrowth Sale-Readiness Regression Results

Date: 2026-07-18 (IST)
Tester: Sol/Codex
Result: **FAIL — 6/70 checklist lines passed in full; 64/70 failed or were only partially exercised.**
Disposition: Record only. No application-code or schema fix was made during this matrix.

## Exact test target

- Git integration branch: `codex/production-hardening-baseline`
- Tested commit: `d74ca83a7c243861de2404bacd154e1c97e4dcad`
- Vercel deployment: `dpl_3MgaeN8bEnUtbJavXYpsdeK6ZETB`
- Vercel URL: `https://bharat-growth-ovco7s48f-darshan-jahagirdars-projects.vercel.app`
- Deployment state: READY / Preview / `bom1`; Git SHA matched the tested commit.
- Supabase target: staging ref `qokaaggeqahayxsybgds`; migrations 001–049 were already applied and matrix-verified.
- Preview variable scope: branch-scoped Preview Supabase URL, anon key, and service-role key only. No Meta/WhatsApp credentials were present.
- Production: no production service was accessed. Git `main` remained `8c389098db7e31180b5bdd6f1661adfd4bdc902b`.

## Fixture and mutation record

The disposable fixture prefix was `SR-D74`. The durable synthetic staging owner fixture documented in `MIGRATION_RUNBOOK.md` was reused only for authentication and was preserved. Raw phone/OTP values are intentionally omitted.

Created during the run:

- Five disposable products covering GST 0/5/12/18/28, including one stock-tracked product.
- One inline Bring-Back tag and two disposable customers (POS and storefront checkout).
- Invoices `BG/2026-27/00003` through `BG/2026-27/00009` covering cash, UPI, card, khata, SO conversion, online checkout, and negative-stock POS.
- SO `SO/2026-27/00003`, PO `PO/2026-27/00002`, one converted purchase bill, inventory movements, loyalty and credit-ledger entries, repayments, and one online order.

Cleanup readback after the matrix:

- Disposable products, tags, customers, consent logs, invoices, sales orders, purchase orders, and purchase bills: all `0`.
- Durable active owner rows: `1`; durable owner shops: `1`.
- The durable owner fixture was not deleted or modified during cleanup.

## High-value transaction evidence

- Phone Auth: the app sent canonical E.164 `+91…`; the hosted staging Auth identity and fixed-OTP map used Supabase's normalized digits. Six-cell OTP entry plus Enter reached `/billing` on the exact preview.
- Cash: `BG/2026-27/00003`, total ₹139.24, 18% GST, CGST ₹10.62, SGST ₹10.62.
- UPI: `BG/2026-27/00004`, total ₹22.05, 5% GST, odd-paise split CGST ₹0.53 / SGST ₹0.52. The shop had no UPI ID, so the QR confirmation path did not run.
- Card: `BG/2026-27/00005`, total ₹37.63, 12% GST.
- Khata: `BG/2026-27/00006`, ₹131.08; valid repayments serialized to ₹110.00 outstanding, and an overpayment was rejected.
- Loyalty: running balance advanced to `2` after the cash and khata customer sales.
- Stock adjustment: +2 and -1 RPC movements succeeded; a cross-tenant stock RPC was rejected.
- SO conversion: `SO/2026-27/00003` → `BG/2026-27/00007`, one fractional item processed.
- PO conversion: `PO/2026-27/00002` made no stock change while a draft, then received `1.25` units on conversion.
- POS/online strictness: POS saved `BG/2026-27/00009` at resulting stock `-1`; acceptance of online invoice `BG/2026-27/00008` was rejected for insufficient stock, then succeeded after an authorized +2 recovery movement; duplicate acceptance was rejected and final stock was `0`.
- Storefront: tracked stock clamped cart quantity to one, checkout required the order-data consent checkbox, one order was server-created, and the same tab handed off to WhatsApp Web simulation. No message was sent.
- GST export: the dashboard control was present and invoked; the downloaded file was not inspected because the browser session was reset before artifact capture.

## Full checklist ledger

Every checklist line is recorded below. `FAIL` includes incomplete/manual-evidence gaps even where supporting unit coverage exists.

### Authentication, onboarding, and tenancy

| ID | Result | Evidence |
|---|---|---|
| A1 | FAIL | Current India formatting, six OTP cells, Enter, and `/billing` redirect passed. Paste, backspace, and resend were not re-exercised in the final session. |
| A2 | FAIL | Email magic-link delivery and `/auth/callback` were not executed. |
| A3 | FAIL | Successful authenticated billing access was observed; authenticated-login exclusion and an unauthenticated protected-route attempt were not both captured. |
| A4 | FAIL | A new onboarding identity/shop was not created; orphan rollback was not exercised. |
| A5 | FAIL | A cross-tenant stock RPC was rejected, but UI/API/direct-client read and mutation coverage was not complete. |
| A6 | FAIL | Skipped by rule: production was not accessed, including a production credential-negative test. |
| A7 | FAIL | Exact TopNav routes rendered; logout was not executed in the final authenticated session. |

### Billing, customer, tax, payment, stock, and credit

| ID | Result | Evidence |
|---|---|---|
| B1 | FAIL | Customer name/phone and product SKU searches worked. All debounce/stale, HSN, barcode, and scanner paths were not manually covered. |
| B2 | FAIL | Customer select, GSTIN validation, loyalty, khata balance, and repayment worked. UI customer creation/clear, image path, and the entire consent-log UI path were not covered; image upload was skipped for migration-018 safety. |
| B3 | FAIL | F8 and Save & Print were used, but the complete keyboard/navigation/modal-lock matrix was not manually exercised. |
| B4 | FAIL | Fractional quantities were preserved in SO/PO conversion; duplicate-row increment and POS row removal were not fully exercised. |
| B5 | FAIL | GST 0/5/12/18/28 payloads, intra-state splits, numbering, financial year, and IST date were observed. IGST, composition Bill of Supply, and the full rounding matrix were not. |
| B6 | FAIL | Cash, UPI, card, and credit invoices saved with exact totals. Split is not offered by `PAYMENT_MODES`; the UPI QR amount/confirmation path did not run because staging had no UPI ID. |
| B7 | FAIL | Walk-in and customer invoices, low-stock alert, and Sales Order creation worked. Receipt-send ordering was not executed. |
| B8 | PASS | POS saved at resulting stock `-1`; online acceptance rejected insufficient stock, succeeded only after recovery stock, and rejected a duplicate accept. |
| B9 | FAIL | Khata sale, two serialized valid repayments, and overpayment rejection reconciled. A true simultaneous two-session repayment race was not run. |
| B10 | FAIL | Loyalty running balance advanced through cash and khata sales; the complete customer-switch matrix was not manually run. |
| B11 | FAIL | One pending online order was created, strict-accepted, and duplicate-guarded. Realtime/polling UI, explicit reject action, and online-order print were not fully covered. |

### Products and inventory

| ID | Result | Evidence |
|---|---|---|
| P1 | FAIL | UI create/search preserved rupee/paise, SKU, HSN, barcode, category, unit, GST, and tag. Edit hydration and every tracked/threshold/vertical-attribute field were not manually rechecked. |
| P2 | FAIL | Skipped by rule because customer/product image paths could touch the separately pending migration-018 bucket decision. |
| P3 | PASS | Inline `SR-D74 Return` tag was created, selected, rendered in the product row, and removed during cleanup. |
| P4 | FAIL | +2/-1 tenant RPC movements and low-stock dashboard alert passed. The full product Stock modal error/success and zero-badge UI sequence was incomplete. |
| P5 | FAIL | CSV template/download/preview/validation/insertion was not executed. |

### Purchases and orders

| ID | Result | Evidence |
|---|---|---|
| O1 | FAIL | New Purchase shop/quota and field validation were not manually exercised. |
| O2 | FAIL | The complete speed-grid keyboard/validation matrix was not manually exercised. |
| O3 | FAIL | AI scan was not run; no approved bill-image fixture was supplied, and migration-018 image scope remained excluded. |
| O4 | FAIL | Atomic stock receipt was covered through PO conversion, not the complete New Purchase bill/reset/skipped-row UI flow. |
| O5 | FAIL | Draft PO payload and zero stock delta passed by RPC; the full UI flow was not exercised. |
| O6 | FAIL | Purchase History UI ordering/expansion/fallback/empty/error matrix was not exercised. |
| O7 | FAIL | Orders UI tabs, pagination, expansion, and toast matrix was not fully exercised. |
| O8 | FAIL | WhatsApp order messages were not sent; no live provider was invoked. |
| O9 | FAIL | Fulfilled double-action guards were observed for online accept, but full SO/PO cancellation UI coverage was not run. |
| O10 | FAIL | SO→invoice and PO→bill succeeded with fractional quantities, status, and stock effects; composition behavior and UI refresh evidence were incomplete. |

### Dashboard and progress

| ID | Result | Evidence |
|---|---|---|
| D1 | FAIL | Today/default date rendered in IST; every date range and boundary/fallback was not manually exercised. |
| D2 | FAIL | KPI, revenue, top-product, inventory, and khata cards/charts rendered; complete empty/loading/tooltip/color coverage was not captured. |
| D3 | FAIL | Storefront link rendered and GST export was invoked; downloaded CSV rows and sanitized filename were not inspected. |
| D4 | FAIL | Khata hitlist rendered. Reminder send/dialog was intentionally not invoked without a live provider. |
| D5 | FAIL | Low-stock list rendered; the negative-stock list was not revisited before recovery. |
| D6 | FAIL | “Log Missing Delivery” was not exercised. |
| D7 | FAIL | Retention ROI live/empty states were not manually exercised. |
| D8 | FAIL | `/progress` local-only cycling, persistence, momentum, and reset were not manually exercised. |

### Campaigns and WhatsApp

| ID | Result | Evidence |
|---|---|---|
| C1 | FAIL | Existing recommended-campaign state was not manually audited for retrofit/no-duplicates. |
| C2 | FAIL | Rule editing, toggle, Enable All, stats, and ROI UI were not manually exercised. |
| C3 | FAIL | Storefront order-data consent remained required and marketing optional; full marketing-match filtering was not run. |
| C4 | FAIL | No Meta credentials were present and no live send occurred. Daily cap/claim/release/retry simulation was not run. |
| C5 | FAIL | Cron Bearer rejection was not invoked; secrets were not exposed. |
| C6 | FAIL | Receipt/khata/system-alert negative-route matrix was not invoked. |
| C7 | FAIL | Webhook verification/signature and STOP-equivalent payloads were not invoked. |

### Storefront Wave 6 matrix

| ID | Result | Evidence |
|---|---|---|
| S1 | FAIL | Valid storefront loaded; invalid UUID/not-found/warning/fatal states were not all exercised. |
| S2 | FAIL | Expected public fields and tracked/untracked UI semantics rendered; the tracked-product-missing-inventory case was not separately created. |
| S3 | FAIL | Modern rendered; Industrial and Festive were not switched and compared. |
| S4 | FAIL | Industrial/Festive category/image/contact/WhatsApp output was not exercised. |
| S5 | FAIL | Modern header, initial, city, sorted categories, products, units, and prices rendered; search-clear/empty-state coverage was incomplete. |
| S6 | FAIL | Tracked quantity clamped at available stock and `+` disabled; zero-stock add rejection/toast was not captured before the browser reset. |
| S7 | FAIL | Add, count, total, floating bar, and drawer worked; decrement/removal/backdrop/scroll-lock matrix was incomplete. |
| S8 | FAIL | Name, phone, and order-data consent were required; address and marketing were optional. Full UPI/Khata selection/disabled-state matrix was incomplete. |
| S9 | FAIL | Server confirmation was observed, but exact payload order and per-attempt idempotency-key reuse were not inspected manually. |
| S10 | FAIL | Network/non-2xx error behavior was not forced. |
| S11 | FAIL | One approved order was created, cleared, accepted, handed off in the same tab to WhatsApp simulation, and fully cleaned. Idempotency-key retirement was not directly inspected. |
| S12 | FAIL | Missing-owner-contact disabled state was not exercised; the durable owner fixture intentionally remained. |

### Public receipt

| ID | Result | Evidence |
|---|---|---|
| R1 | FAIL | Invalid/not-found/error/loading and `noindex` were not all manually captured. |
| R2 | FAIL | Save & Print populated the receipt iframe, but the browser session reset before a direct receipt DOM/layout capture; full print/share/mobile evidence is absent. |
| R3 | PASS | Pre-049 compatibility was preserved by prior Waves 6–7 evidence; staging migration 049 matrix verified anonymous direct invoice/user denial while the constrained Storefront facade and checkout remained functional in this run. |

### Visual and release evidence

| ID | Result | Evidence |
|---|---|---|
| V1 | FAIL | Exact staging application/deployment/fixture were fixed, but no separate candidate capture was produced. |
| V2 | FAIL | No pixel/byte comparison was produced. |
| V3 | FAIL | No blocking application error was seen in tested flows, but a complete console and Vercel runtime error-log sweep was not captured. |
| V4 | PASS | Disposable staging data read back at zero and the durable owner fixture remained. Local temporary test files were removed at closeout. |
| V5 | PASS | Git SHA, branch, preview deployment, staging ref, migrations, and unchanged production Git head were recorded exactly. |
| V6 | FAIL | Repository results/handoff were prepared, but this line remains FAIL until the docs-only PR, Google handoff readback, and Slack milestone all complete. |
| V7 | PASS | Production Git `main` remained `8c38909`; no production Supabase/Vercel endpoint was accessed or mutated. |

## Repository verification

- `npm test`: PASS — 30 files, 143 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS — Next.js production build generated all 25 routes.

## Release decision

Closeout artifacts completed after the point-in-time matrix ledger was frozen:

- Docs-only PR: `https://github.com/darshan-Jahagirdar/bharat-growth/pull/15`
- Canonical Google handoff: updated and read back with the NO-GO result, exact
  staging checkpoint, cleanup, production safety, PR, and next gate.
- Signed `#bharatgrowth` milestone:
  `https://bharatgrowth.slack.com/archives/C0BG39UE1A9/p1784399937146619`

V6 remains a historical `FAIL` because those three artifacts were incomplete at
the time that checklist line was measured; the post-matrix closeout above does
not retroactively change the recorded regression score.

**NO-GO for production sale readiness.** The high-value transaction engine passed, but 64 checklist lines remain failed or incomplete, including email/onboarding, full keyboard coverage, IGST/composition, UPI QR confirmation, image/CSV/AI paths, campaign/WhatsApp negative routes, all storefront themes/error paths, direct receipt rendering, and visual/runtime-log evidence. Fixes and follow-up verification must be scoped separately; this run made none.

---

## Triage Addendum — sale-readiness burn-down

Date: 2026-07-19 (IST)

Tester: Sol/Codex

Disposition: append-only follow-up to the frozen ledger above; no application
code or schema was changed.

### Exact burn-down target

- PR #15 was green and was merged first. Integration is exact
  `7add48b05a9f282948566e583bfed65ff7595eb4` on
  `codex/production-hardening-baseline`.
- Burn-down branch: `codex/sale-readiness-burndown`, based on exact `7add48b`.
- Exact Vercel Preview deployment:
  `dpl_DrQt7XfU3z18aKEVoZ6f4a7fYDha`, READY / Preview / `bom1`, Git SHA
  `7add48b`.
- Stable integration alias:
  `https://bharat-growth-git-codex-pro-fbbd8e-darshan-jahagirdars-projects.vercel.app`.
- Supabase: staging ref `qokaaggeqahayxsybgds`, continuous migrations
  001–049.
- Preview variables contained only the three staging Supabase values. No Meta
  or WhatsApp provider credentials were present, and no message was sent.
- Production was not accessed. Git `main` remained exact `8c38909`.

### Auth environment correction and stop decision

The first delivered staging email magic link returned to `localhost:3000`.
This was **ENV-CONFIG**, not an application failure. The permanent staging-only
configuration was corrected through the Supabase Management API and read back:

- Site URL is the stable integration preview alias above.
- Redirect allowlist retains `http://localhost:3000/**` for local development
  and adds
  `https://bharat-growth-*-darshan-jahagirdars-projects.vercel.app/**` for
  ephemeral integration previews.
- The configuration is a durable staging fixture and was not restored during
  cleanup. The wildcard must never be copied to production.

A fresh email delivery was then throttled by staging Auth. Darshan authorized
one final attempt and directed the run to stop bothering with Auth if it failed
because Auth will be rebuilt before launch. The preserved browser tab was no
longer accessible on that final attempt. No further Auth retries were made.
A2 and all newly blocked authenticated-only evidence are therefore gated to the
planned Auth rebuild; the redirect incident is not counted as an application
defect.

### Triage of the historical 64

`PARTIAL` means the frozen run passed the core behavior but left edges
incomplete. `NOT-RUN` means the frozen run did not execute a then-runnable line.
`GATED` means the line required production, Meta/provider configuration, the
migration-018 image decision, or Darshan's visual waiver. The outcome column
records this burn-down; later Auth-rebuild and non-destructive fault-injection
gates are called out explicitly.

| ID | Frozen-ledger triage | Burn-down outcome and exact evidence |
|---|---|---|
| A1 | PARTIAL | GATED — original phone OTP core evidence remains valid; complete Auth edge replay waits for the planned Auth rebuild. |
| A2 | NOT-RUN | GATED — mail delivery worked once; localhost redirect was corrected as staging ENV-CONFIG. Fresh end-to-end replay was stopped after delivery throttling and the one authorized final tab-recovery attempt failed. |
| A3 | PARTIAL | **FAIL — DEFECT-01.** Unauthenticated `/billing`, `/dashboard`, `/onboarding`, purchase history/new, orders, campaigns, and products redirected to `/login?next=…`. Unauthenticated `/settings` instead rendered the protected TopNav shell and stayed on `/settings`. Authenticated `/login` exclusion is Auth-rebuild-gated. |
| A4 | NOT-RUN | GATED — a well-formed unauthenticated onboarding probe returned application HTTP 401 and created zero shops; authenticated creation and forced orphan rollback require the Auth rebuild. |
| A5 | PARTIAL | GATED — prior cross-tenant RPC rejection stands; complete authenticated UI/API/direct-client tenancy replay requires Auth. |
| A6 | GATED — production | GATED — production was intentionally untouched. |
| A7 | PARTIAL | GATED — protected-route map was checked unauthenticated; authenticated TopNav/logout replay requires Auth. |
| B1 | PARTIAL | GATED — complete debounce, stale-response, HSN, barcode, and scanner UI replay requires Auth. |
| B2 | PARTIAL | GATED — customer/loyalty/khata core stands; authenticated UI replay requires Auth and image paths remain separately gated by migration 018. |
| B3 | PARTIAL | GATED — billing F-key, row-navigation, focus, modal-lock, clear, and print keyboard matrix requires Auth. |
| B4 | PARTIAL | GATED — duplicate-row and POS removal replay requires Auth. |
| B5 | PARTIAL | GATED — prior GST-rate/intra-state evidence stands; IGST and composition Bill of Supply UI replay requires Auth. |
| B6 | PARTIAL | GATED — prior cash/UPI/card/credit persistence stands. Split is not offered; UPI QR setup/confirm/restore could not run without authenticated Settings/Billing. Durable UPI remained null. |
| B7 | PARTIAL | GATED — authenticated receipt-send/action-order replay requires Auth; no provider send was attempted. |
| B9 | PARTIAL | GATED — sale, serialized repayments, and overpayment evidence stands; the simultaneous authenticated-session race requires Auth. |
| B10 | PARTIAL | GATED — prior loyalty accrual stands; customer-switch UI matrix requires Auth. |
| B11 | PARTIAL | GATED — prior strict online accept/duplicate evidence stands; polling/Realtime/reject/print UI replay requires Auth. |
| P1 | PARTIAL | GATED — complete authenticated edit/hydration and vertical-attribute matrix requires Auth. |
| P2 | GATED — migration 018 | GATED — Darshan's separate migration-018 bucket decision remains pending; no image path was touched. |
| P4 | PARTIAL | GATED — prior tenant RPC and low-stock evidence stands; complete Stock modal/badge UI replay requires Auth. |
| P5 | NOT-RUN | GATED — CSV template/preview/validation/insertion UI requires Auth. |
| O1 | NOT-RUN | GATED — New Purchase validation matrix requires Auth. |
| O2 | NOT-RUN | GATED — purchase speed-grid Enter/Tab/F10/focus/removal matrix requires Auth. |
| O3 | GATED — migration 018 | GATED — no approved image-path decision or bill-image fixture. |
| O4 | PARTIAL | GATED — prior atomic receipt evidence stands; complete bill/reset/skipped-row UI replay requires Auth. |
| O5 | PARTIAL | GATED — prior draft PO zero-stock evidence stands; full UI replay requires Auth. |
| O6 | NOT-RUN | GATED — Purchase History latest-100/expand/fallback/empty/error UI requires Auth. |
| O7 | PARTIAL | GATED — Orders tabs/pagination/expansion/toasts require Auth. |
| O8 | GATED — Meta | GATED — Meta credentials were absent; no Sales/PO WhatsApp message was sent. |
| O9 | PARTIAL | GATED — complete SO/PO cancellation UI replay requires Auth. |
| O10 | PARTIAL | GATED — prior SO→invoice and PO→bill conversions stand; composition/refresh UI evidence requires Auth. |
| D1 | PARTIAL | GATED — complete authenticated IST date-range/fallback matrix requires Auth. |
| D2 | PARTIAL | GATED — complete KPI/chart empty/loading/tooltip/color UI matrix requires Auth. |
| D3 | PARTIAL | GATED — GST export row and filename inspection requires authenticated dashboard access. |
| D4 | PARTIAL | GATED — reminder dialog requires Auth and the provider send remains Meta-gated. |
| D5 | PARTIAL | GATED — negative-stock anomaly UI replay requires Auth. |
| D6 | NOT-RUN | GATED — Log Missing Delivery UI/RPC replay requires Auth. |
| D7 | NOT-RUN | GATED — retention ROI live/empty UI requires Auth. |
| D8 | NOT-RUN | **PASS.** `/progress` grouped milestones rendered; a milestone cycled on-deck→in-motion, survived reload from local storage, changed the completion/active summary, and Reset restored the four-active baseline. No database mutation occurred. |
| C1 | NOT-RUN | GATED — recommended-campaign retrofit/no-duplicate UI audit requires Auth. |
| C2 | NOT-RUN | GATED — rule edit/toggle/Enable All/stats/ROI UI requires Auth. |
| C3 | PARTIAL | GATED — storefront order-data versus optional marketing consent remained distinct; complete authenticated match-filter UI requires Auth. |
| C4 | GATED — Meta | GATED — claim/send/release/retry provider classification requires the Meta simulation gate; no send occurred. |
| C5 | NOT-RUN | GATED — the exact preview has no cron/provider secret. A direct cron invocation was not authorized because it could claim or send; no secret appeared in a URL or output. |
| C6 | NOT-RUN | GATED — receipt, khata-reminder, and system-alert routes each rejected unauthenticated empty JSON with application HTTP 401 before the provider path. Cross-shop/ineligible authenticated cases require Auth. |
| C7 | NOT-RUN | GATED — invalid webhook verification returned 403 and an unsigned POST returned 401. Valid signed STOP-equivalent mutation requires the Meta credential/simulation gate. |
| S1 | PARTIAL | GATED — loading, invalid UUID, valid not-found, and live Storefront states passed. Product-query warning/fatal injection was not possible without changing schema/code or adding a fault-injection fixture. |
| S2 | PARTIAL | **PASS.** Anon-role read exposed only the exact shop allowlist; a sensitive shop column and direct invoice read were denied. Two tracked fixtures mapped to zero and one untracked fixture had no inventory row while the Storefront rendered it as addable. |
| S3 | PARTIAL | **PASS.** Modern, Industrial, and Festive dispatched on the exact preview; the durable shop was restored to Modern by readback. |
| S4 | NOT-RUN | **PASS.** Industrial/Festive category grouping, item/unit/price output, conditional owner contact, and per-product WhatsApp links rendered; no link was followed and no message was sent. |
| S5 | PARTIAL | **PASS.** Modern header/city/sorted categories and product copy rendered. Search filtering, no-products state, and the visible clear control were exercised and restored the catalog. |
| S6 | PARTIAL | **PASS.** Prior tracked clamp/disabled-plus evidence plus this run's tracked zero-stock `Out of Stock`/disabled ADD and untracked addability completed the line. |
| S7 | PARTIAL | GATED — add, increment, count, total, floating bar, and drawer were rechecked. The browser-control session repeatedly timed out on the final decrement/backdrop clicks; no database state was involved. |
| S8 | PARTIAL | **PASS.** Drawer DOM showed required name/phone/order-data consent, optional address/marketing, UPI/Khata controls, and disabled submit before required fields; the frozen run already captured required-consent enablement. |
| S9 | PARTIAL | GATED — prior server-confirmed checkout stands; exact per-attempt idempotency-key reuse needs network-level test instrumentation not available in this manual session. |
| S10 | NOT-RUN | **PASS.** A tracked item was placed in the drawer, inventory was moved to zero, and checkout returned the exact insufficient-stock non-2xx error in place with no WhatsApp navigation and no created order. |
| S11 | PARTIAL | GATED — prior approved server-created/cleared/same-tab simulation and cleanup stand; direct idempotency-key retirement observation requires network instrumentation. |
| S12 | NOT-RUN | **PASS.** A second throwaway shop without an owner rendered `Shop contact not available`; the durable owner fixture was not altered. |
| R1 | NOT-RUN | GATED — loading, invalid, not-found, and live receipt states passed, and HEAD returned `x-robots-tag: noindex`. A generic fatal loader exception needs a non-destructive fault-injection fixture. |
| R2 | PARTIAL | **PASS.** The synthetic public receipt DOM contained invoice/shop/customer/item/tax/payment/total content, Print/Share, and a successful Print click; at 390px it had no horizontal overflow and controls stayed in viewport. |
| V1 | GATED — visual waiver | GATED — Darshan explicitly waives V1 until after the reskin. |
| V2 | GATED — visual waiver | GATED — Darshan explicitly waives V2 until after the reskin. |
| V3 | PARTIAL | **PASS.** Public/login/progress/Storefront/receipt browser-console sweep had zero entries. Exact-preview error logs contained one non-blocking `refresh_token_not_found` from the abandoned Auth flow; it returned HTTP 200 and login still rendered. No blocking runtime error was present. |
| V6 | PARTIAL | PENDING CLOSEOUT — repository docs are being committed; the docs-only PR, Google readback, and one signed Slack milestone complete this line. |

### Confirmed defect

1. **DEFECT-01 — `/settings` is not protected by middleware.** In an
   unauthenticated browser, `/settings` remained at that route and rendered the
   protected TopNav/Logout shell, while every tested `/billing` and `/dashboard`
   route redirected to `/login?next=…`. Record only; no code change was made.

### Fixture cleanup and invariant readback

- Disposable prefix: `SR-BD15`.
- Removed and verified at zero: four products, one customer, one synthetic
  receipt and its item, one missing-owner throwaway shop, the unauthenticated
  onboarding probe, and the test email Auth aliases.
- No checkout order was created by the strict-stock non-2xx case.
- Durable staging readback: one active owner and one durable shop remained;
  theme `modern`, GST type `regular`, and UPI ID null.
- The durable owner fixture and permanent staging Auth callback configuration
  remain intentionally in place.

### Corrected burn-down scoreboard

- **Defects found: 1** (`DEFECT-01`, unauthenticated `/settings`).
- **Coverage remaining: gated lines only** — planned Auth rebuild,
  Meta/provider credentials, production-only A6, migration-018 image decision,
  Darshan's post-reskin V1/V2 waiver, and explicit non-destructive
  fault-injection/network-observability fixtures.
- **Production remains NO-GO.** This burn-down reduced runnable evidence gaps;
  it did not authorize a release or fix the recorded defect.
