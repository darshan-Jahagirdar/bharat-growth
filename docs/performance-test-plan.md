# BharatGrowth — Backend & System Stress-Test Plan

> **Status:** Approved plan, implementation in progress (see `performance-progress.md`).
> **Scope:** Backend / DB / system stress assessment — *not* primarily a visual UI test.
> **Target environment: LOCAL `supabase start` ONLY.** Nothing hosted, staging, or production is
> ever contacted. The stack is a disposable local Postgres (Docker) at `http://127.0.0.1:54321`.

---

## 0. Ground rules & safety constraints

These are non-negotiable and enforced by the harness, not just by convention:

- **Never** touch production or any hosted project. The env-guard hard-aborts unless the target
  resolves to `127.0.0.1` / `localhost`.
- **Never** use real customer data — only clearly-tagged synthetic tenants (`LOADTEST-` + `perf_run_id`).
- **Never** send real WhatsApp / SMS / email / payment requests — all external senders forced to
  **simulated** mode.
- **Never** run destructive migrations. The local DB is disposable; `supabase db reset` restores it.
- Begin at **low load** and increase gradually; each milestone is an approval gate.
- **Stop immediately** if error rate > 10%, a data-integrity invariant fails, or the stack becomes
  unstable.
- Do **not** exceed **200 virtual users** or **60 minutes** total in a run without explicit approval.

---

## 1. Critical request paths & likely bottlenecks

Derived from direct code inspection of the RPCs, API routes, and RLS policies.

| # | Path | Entry point | Backend | Bottleneck hypothesis |
|---|------|-------------|---------|-----------------------|
| 1 | **POS billing** | `src/app/billing/page.tsx` → `saveInvoice()` (`src/lib/billing/billingQueries.ts:177`) | RPC `save_invoice` (migrations `024`, `035`) | `pg_advisory_xact_lock(hashtext(shop_id ‖ fy))` **serializes ALL concurrent invoices for one shop within a financial year.** The per-item loop is non-batched: `SELECT is_stock_tracked` per product, inventory find-or-create, `inventory_movements` insert, plus loyalty / khata / attribution / GSTIN blocks. `SELECT COALESCE(MAX(invoice_sequence),0)+1` runs per call. |
| 2 | **Storefront checkout** | `POST /api/storefront/checkout` (`route.ts`) | admin (RLS-bypass) client → RPC `create_online_order` (migration `033`) | Same per-shop advisory-lock serialization; customer UPSERT (`ON CONFLICT (shop_id, phone_number)`) + `consent_logs` insert + item loop. **Public / unauthenticated** → primary abuse & spike surface. Prices/GST re-derived server-side (good), but the whole thing is one long transaction. |
| 3 | **Accept / Reject online order** | RPC `accept_online_order` / `reject_online_order` (migration `033`) | `SELECT … FOR UPDATE` on the invoice + each inventory row | Row-lock contention between the POS "online orders" drawer and storefront writes; the **oversell window** — online checkout guards stock, but POS `save_invoice` allows negative stock (soft-block), so concurrent POS + online sales of the same SKU can drive stock negative. |
| 4 | **Auth gate** | Every authenticated API route → `requireShopUser()` (`src/lib/api/requireShopUser.ts`) | `supabase.auth.getUser()` (JWT verify) + `users ⋈ shops!inner` join per request | Per-request auth verification + join overhead; dependency on GoTrue availability/latency. |
| 5 | **RLS on every tenant table** | all reads/writes | `get_current_shop_id()` — `SECURITY DEFINER STABLE`, wrapped `(SELECT …)` for initplan (migrations `001`, `008`) | Extra `users` lookup per statement. The `(SELECT …)` initplan pattern is correct and keeps it once-per-statement, but it is still measured under load. |
| 6 | **Campaign cron** | `GET /api/cron/campaigns` (`route.ts`) | admin client, **N+1 pattern** (per active rule → query matching invoices → per match a duplicate-check query) + **sequential** WhatsApp sends | Long-running serverless function → Vercel timeout risk; work grows unbounded with invoice/rule volume. Primary **soak** concern. |
| 7 | **WhatsApp receipt** | `POST /api/whatsapp/send-receipt` (`route.ts`) | auth + single-invoice lookup + external send | External-call latency dominates; **must run in simulated mode** under test. |
| 8 | **Public storefront listing / receipt read** | public RLS (migrations `013`, `014`) | product ⋈ inventory join | Read scaling; index coverage validated against migration `023` (`idx_inventory_product_id`, `idx_invoices_shop_status`, `idx_invoice_items_invoice_id`). |

**Index note:** `save_invoice` / `create_online_order` compute the next sequence via
`MAX(invoice_sequence) WHERE shop_id = ? AND financial_year = ?`. Ramp/stress runs will confirm
whether a `(shop_id, financial_year, invoice_sequence)` index is warranted; if the planner
seq-scans here it compounds the advisory-lock hold time.

---

## 2. Load model

Grounded in the ICP from `CLAUDE.md` ("single-store Indian SMBs doing 20–200 bills/day") and the
3-shop pilot in `supabase/seed.sql`.

- **Tenancy fan-out:** 50 shops (baseline/sustained) → up to 200 shops (stress). 1 owner + 2–4
  cashiers per shop.
- **Billing rate:** peak ~200 bills/day/shop concentrates into rush-hour bursts of ~3–6 concurrent
  saves per shop. 3–8 line items/invoice. ~40% of invoices carry a `customer_id` (activating the
  loyalty / khata / attribution branches).
- **Storefront:** spikier and unauthenticated; modelled at 2–5× the billing burst during a
  simulated "campaign spike".
- **Request mix per steady VU-second:**
  - ~55% reads (product catalogue, customer lookup, dashboard/orders drawer),
  - ~30% POS `save_invoice`,
  - ~10% storefront checkout,
  - ~5% receipt send / accept-order.
- **Two contrasting concurrency shapes:**
  - **Spread** — VUs distributed across many shops (advisory locks rarely collide → should scale
    near-linearly). Establishes the "happy path" ceiling.
  - **Concentrated** — many VUs pinned to **one shop** (advisory lock always collides → measures the
    serialization penalty). This is the deliberate DB-concurrency stressor.

---

## 3. Testing strategy

Each scenario states what it proves. DB invariant checks (§8) run **before and after** every
heavy scenario.

1. **Baseline** — 5–10 VUs, single shop + spread — establish p50/p95/p99 per path with headroom.
2. **Sustained load** — ~50 VUs, realistic mix, ~10 min — steady-state stability; no latency creep,
   no connection/memory leak.
3. **Stress / ramp** — step 10 → 200 VUs — find the **knee** where latency/error rate degrade;
   expose advisory-lock queueing and connection-pool limits.
4. **Spike** — idle → sudden storefront burst → idle — cold-start and recovery behaviour; does the
   system shed load gracefully and return to baseline?
5. **Soak** — low-to-moderate load for 30–45 min (≤ 60 cap) — temporal drift, memory growth,
   connection accumulation; interaction with the campaign cron running concurrently.
6. **Database concurrency** — many VUs driving `save_invoice` / `create_online_order` on the **same
   shop** — asserts **zero duplicate or gapped invoice numbers**, correct inventory arithmetic, and
   a near-zero deadlock/serialization-failure rate.
7. **Multi-tenant & RLS isolation** — a shop-A JWT attempts shop-B reads and writes (must return
   403 / empty); confirm the admin storefront path validates `shop_id` server-side; confirm
   `consent_logs` immutability (update/delete rejected).
8. **Failure & retry** — inject faults (malformed payloads, a killed local DB connection, WhatsApp
   simulated-failure); assert idempotency (storefront `idempotency_key`), no partial writes on
   rollback, and graceful degradation.

---

## 4. Tools & why they fit this repo

- **k6 (primary load generator).** JavaScript scenarios, native ramping / constant-arrival-rate
  executors (ideal for spike & soak), and **built-in `thresholds` that abort a run** — which maps
  directly onto the safety gates in §0/§8. It can hit both the Next.js API routes and Supabase
  PostgREST/RPC endpoints with a real JWT. Chosen over Artillery mainly for first-class thresholds
  and the xk6 ecosystem.
- **k6 + seeded JWTs.** VUs authenticate against the **local** GoTrue endpoint
  `POST /auth/v1/token?grant_type=password` using seeded email/password load users, then reuse the
  token per-VU. This mirrors the existing dev-auth pattern (`supabase/migrations/011_dev_auth_user.sql`
  and `signInWithPassword` in `src/components/DevLogin.tsx`).
- **SQL invariant checker (Node + `pg`).** Connects directly to the **local** Postgres (`54322`) and
  asserts the data-integrity invariants in §8. This — not latency — is the real pass/fail signal for
  the concurrency and tenancy scenarios.
- **Playwright (narrow).** Only 2–3 browser flows (keyboard-driven POS billing; storefront checkout)
  to confirm the end-to-end experience under light concurrency. It is **not** the load engine.
- **Optional:** `pg_stat_statements` / `pgbench` for a DB-side view of top statements and lock waits
  during ramp/soak.

---

## 5. Seed-data requirements

A deterministic, clearly-tagged, fully-reversible synthetic generator under `perf/seed/` — kept
**separate** from `supabase/seed.sql` so the 3-shop pilot data is never modified.

- **Shops:** parameterised (50 / 200), mixed `gst_type` (regular / composition) and verticals
  (tyre / sweet / garment).
- **Users:** 1 owner + 2–4 cashiers per shop, each with a **known email + password** so k6 can mint
  JWTs.
- **Catalogue & stock:** 50–500 products/shop across mixed HSN codes and GST slabs (0/5/12/18/28),
  a realistic share `is_stock_tracked = true`, with matching `inventory` rows.
- **Customers:** 1–5k per shop (some with consent, some with khata balances).
- **History:** invoices back-dated so the campaign cron finds matches; `tags` + `campaign_rules`
  wired to those products.
- **Safety tagging (the crux of "no changes"):**
  - synthetic phone numbers drawn from a reserved non-real test range,
  - names prefixed `LOADTEST-`,
  - a per-run `perf_run_id` marker embedded on/traceable to every inserted row,
  - so a single cleanup script can delete **exactly and only** the synthetic rows.
- Idempotent, batched inserts; a `--dry-run` mode prints intended volumes without writing.

---

## 6. Safety controls (hard gates)

- **Env-guard (local-only).** `perf/guard/check-env.mjs` refuses to run unless the target host is
  `127.0.0.1` / `localhost`. Any staging- or prod-looking URL hard-aborts. This is stronger than an
  allowlist — the test literally cannot reach hosted data.
- **No real side effects.** WhatsApp/SMS/email/payments forced to **simulated** mode (the WhatsApp
  service already supports a `simulated` result); no Razorpay/Meta egress; the cron is pointed at the
  simulated sender. A post-run assertion checks the simulated-mode counters to prove zero real egress.
- **No destructive migrations.** Seed and cleanup touch only `perf_run_id` / `LOADTEST-` rows.
  `supabase db reset` is the always-available full restore.
- **Auto-abort thresholds (k6).** A run stops if error rate > 10%, p95 breaches its ceiling, an
  invariant check fails, or the stack becomes unstable.
- **Caps.** ≤ 200 VUs and ≤ 60 min total per run without further approval; every scenario starts low
  and steps up; the between-scenario invariant check must pass before escalating.

---

## 7. Exact commands

> Run only after the corresponding milestone is approved. Everything targets the local stack.

```bash
# ── Prereqs (one-time) ─────────────────────────────────────────────
brew install k6                 # or: choco install k6 / apt
npm i -D playwright pg

# ── Bring up the LOCAL disposable stack + apply migrations ─────────
supabase start
supabase db reset               # applies supabase/migrations + seed.sql to the local DB
# (Docker-less fallback, e.g. CI: build the same schema on a plain local Postgres)
#   DB=bg_perf perf/local-ci/apply.sh   # shim + all migrations + seed.sql

# ── Preflight (safe, read-only) ────────────────────────────────────
npx tsx scripts/test-db.ts                       # connectivity, pointed at 127.0.0.1 keys
node perf/guard/check-env.mjs                     # HARD-ABORTS unless target is 127.0.0.1/localhost

# ── Seed synthetic tenants into the LOCAL db (reversible) ──────────
node perf/seed/seed.mjs --shops 50 --run-id "$PERF_RUN_ID" --dry-run   # preview volumes only
node perf/seed/seed.mjs --shops 50 --run-id "$PERF_RUN_ID"

# ── Load scenarios (each an approval gate) ─────────────────────────
k6 run perf/k6/baseline.js
k6 run perf/k6/sustained.js
k6 run perf/k6/stress-ramp.js
k6 run perf/k6/spike.js
k6 run perf/k6/soak.js

# ── DB concurrency (same-shop invoice storm) + invariant gate ──────
k6 run perf/k6/db-concurrency.js
node perf/invariants/check.mjs --run-id "$PERF_RUN_ID"     # PASS/FAIL gate (scope to the run's data)

# ── RLS / tenant isolation + narrow browser flows ─────────────────
k6 run perf/k6/rls-isolation.js
npx playwright test perf/browser/

# ── Teardown (deletes only tagged synthetic rows) ─────────────────
node perf/seed/cleanup.mjs --run-id "$PERF_RUN_ID"
# Full restore at any time:
supabase db reset
```

---

## 8. Measurable pass/fail thresholds

**Latency (local machine — treat absolute ms as a machine-specific baseline; the *knee* and the
*regression %* matter more than raw numbers):**
- POS `save_invoice`: p95 < 800 ms, p99 < 1500 ms
- Reads (catalogue/customer/dashboard): p95 < 400 ms
- Storefront checkout: p95 < 1200 ms

**Errors:** overall < 1% at baseline/sustained; **abort the run at > 10%**.

**Throughput:** sustained scenario holds its target bills/min without p95 regressing > 25% vs the
baseline reference.

**Database concurrency — PASS requires ALL of:**
- zero duplicate invoice numbers per `(shop_id, financial_year)`;
- zero unexpected sequence gaps (beyond legitimately rolled-back transactions);
- `Σ invoice_items.total_paise` reconciles to the parent invoice totals;
- `inventory_movements.quantity_after` equals the running stock derivation;
- `customers.credit_balance_paise` = `Σ credit_ledger` per customer;
- `customers.total_spent_paise` / `visit_count` match the invoice ledger;
- deadlock / serialization-failure rate ≈ 0.

**Multi-tenant:** 0 cross-shop rows ever returned; every child row's `shop_id` matches its parent.

**Resource:** no unbounded DB connection growth; no memory creep across the soak window.

---

## Milestone plan

| Milestone | Deliverable | Runs load? |
|-----------|-------------|------------|
| **M0** | This doc + `performance-progress.md` + `perf/` skeleton + env-guard + `.env.perf.example` | No |
| **M1** | Synthetic seed generator + reversible cleanup + SQL invariant checker; validate on a tiny dataset (extra-care gate) | Minimal (tiny seed) |
| **M2** | k6 auth helper + baseline & sustained scripts; capture reference metrics | Yes (≤ ~50 VU) |
| **M3** | Stress/ramp + spike scripts; locate the knee; document advisory-lock/pool behaviour | Yes (≤ 200 VU) |
| **M4** | DB-concurrency (same-shop storm) + RLS-isolation + invariant gate | Yes |
| **M5** | Soak (≤ 45 min) + failure/retry injection + idempotency verification | Yes (≤ 60 min) |
| **M6** | Narrow Playwright flows + final go/no-go report rolled into `performance-progress.md` | Light |

Every milestone: **start low → check invariants → escalate only on green**, honouring the ≤ 200 VU
/ ≤ 60 min caps. Progress and results are tracked in `docs/performance-progress.md`.
