# BharatGrowth — Performance / Stress-Test Progress Tracker

Living log of the stress-test effort. See `docs/performance-test-plan.md` for the full plan.

**Target environment:** LOCAL `supabase start` only (`http://127.0.0.1:54321`, DB `54322`).
**Global caps:** ≤ 200 VUs, ≤ 60 min/run. **Abort if:** error rate > 10%, any invariant fails, or
the stack becomes unstable.

---

## Milestone status

| Milestone | Description | Status | Notes |
|-----------|-------------|--------|-------|
| **M0** | Docs + `perf/` skeleton + local-only env-guard | ✅ Done | No load run. Deliverables committed. |
| **M1** | Seed generator + reversible cleanup + SQL invariant checker (extra-care gate) | ✅ Done | Validated on a tiny dataset; fully reversible. Details below. |
| **M2** | k6 auth helper + baseline & sustained | 🟡 Partial | k6 scripts built (run on dev machine — no HTTP stack in this container). **DB-tier baseline captured here** — see below. |
| **M3** | Stress/ramp + spike (find the knee) | 🟡 Partial | k6 `stress-ramp.js` + `spike.js` built (dev machine). **DB-tier knee sweep captured here** — see below. |
| **M4** | DB concurrency (same-shop storm) + RLS isolation | ✅ Done (DB tier) | 10/10 isolation checks + same-shop storm integrity PASS here. k6 `db-concurrency.js`/`rls-isolation.js` for dev machine. |
| **M5** | Soak + failure/retry + idempotency | ✅ Done (DB tier) | 5/5 failure/retry PASS; soak surfaced **F-5** (missing index) + **F-6** (erasure vs consent immutability). |
| **M6** | Narrow Playwright flows + final go/no-go report | ✅ Done | Playwright specs built (dev machine); consolidated report below. |

Legend: ✅ done · ⏳ awaiting approval / in progress · ⬜ not started · ❌ blocked/failed

---

## Environment snapshot

| Item | Value |
|------|-------|
| Validation environment | Automation container (no Docker) → plain **Postgres 16.13** on `127.0.0.1:5432` |
| Schema provisioning | `perf/local-ci/apply.sh` (shim + all 35 migrations + `seed.sql`) |
| Node | v22 · `pg` devDependency |
| Supabase CLI / k6 | n/a in container — used on the dev machine at M2+ |
| Latest seed tag validated | `m1final` (removed after cycle) |

> **Note on the validation environment.** Docker isn't available in the automation container, so
> the full `supabase start` stack can't run here. M1 was validated against a real local Postgres 16
> provisioned by `perf/local-ci/apply.sh`, which applies a minimal Supabase shim (auth/storage
> schemas, roles, `auth.uid()`) plus **the actual repo migrations 001–035 and `seed.sql`**. On the
> dev machine (the real target) `supabase start` provides these natively — the shim is a
> Docker-less fallback only. The seed/cleanup/invariant scripts themselves are environment-agnostic
> (they read `PERF_DB_*` and run against whatever local Postgres is configured).

---

## Reference metrics

- **DB-tier baseline (captured):** see the M2 results table below — `save_invoice` p95 = 9 ms at
  4 workers, 0 errors.
- **HTTP baseline/sustained (pending — dev machine):** run `perf/k6/baseline.js` + `sustained.js`
  with `supabase start` + `npm run dev` up, then fill the table below.

| Path (HTTP) | p50 | p95 | p99 | error % | notes |
|------|-----|-----|-----|---------|-------|
| POS `save_invoice` | — | — | — | — | dev-machine k6 |
| Reads (catalogue/customer) | — | — | — | — | dev-machine k6 |
| Storefront checkout | — | — | — | — | dev-machine k6 |

Thresholds (from plan §8): `save_invoice` p95 < 800 ms / p99 < 1500 ms · reads p95 < 400 ms ·
checkout p95 < 1200 ms · errors < 1% steady, abort > 10%.

---

## M1 results (seed + cleanup + invariants)

**Scripts:** `perf/seed/seed.mjs`, `perf/seed/cleanup.mjs`, `perf/invariants/check.mjs`,
`perf/lib/env.mjs` (shared local-only guard + `PERF_DB_*` config).

**Tiny-dataset run (2 shops · 2 cashiers · 6 products · 8 customers · 6 history invoices/shop):**

| Step | Result |
|------|--------|
| env-guard | ✅ passes for `127.0.0.1`, hard-aborts non-local (exit 1) |
| seed `--dry-run` | ✅ full insert path executes then ROLLS BACK — DB counts unchanged |
| seed (real) | ✅ committed 2 shops, 6 users (auth+public), 12 products, 16 customers, 12 invoices, 29 items, 16 inventory movements, 2 credit-ledger, loyalty entries — history generated through the **real `save_invoice` RPC** |
| invariants (scoped to run-id) | ✅ **14/14 PASS** (incl. invoice-number uniqueness, item↔invoice totals, GST line arithmetic, tenant isolation, credit reconciliation, inventory running-balance & final-state) |
| cleanup `--dry-run` | ✅ reports exact rows it would remove, deletes nothing |
| cleanup (real) | ✅ removed tagged shops → all child rows CASCADE; pilot data byte-for-byte restored (shops 3, invoices 0, auth users 1) |

Re-verified end-to-end after a clean `apply.sh` rebuild → identical result.

### Finding F-1 — pilot seed customers don't reconcile to ledgers (pre-existing)
Running the checker over **ALL** data (not scoped) fails `total_spent_reconciliation` and
`visit_count_reconciliation` with 7 violations. These are exactly the 7 hand-authored customers in
`supabase/seed.sql` (Ganesh Tyres, Bikaner Sweets, Trends Boutique) whose `total_spent_paise` /
`visit_count` are set as literals with **no backing invoices/loyalty rows**. This is a property of
the demo seed, not a defect introduced by the harness, and it's untouched by seed/cleanup.
*Implication:* the concurrency/integrity gate runs **scoped to the load `--run-id`** (data generated
through the real RPCs), which reconciles cleanly. Worth deciding later whether the pilot seed should
derive those denormalized fields from transactions.

## M2 results (DB-tier baseline + k6 harness)

**Built:** `perf/k6/` (`lib/config.js`, `lib/auth.js`, `baseline.js`, `sustained.js`) — HTTP load for
the dev machine — and `perf/dbload/run.mjs` — a DB-tier harness that drives the real `save_invoice`
RPC directly against Postgres. `seed.mjs` now emits a manifest (`perf/seed/.manifest.<run-id>.json`,
gitignored) that both drivers consume.

**Why DB-tier here:** Docker isn't available in the automation container, so GoTrue/PostgREST/Next
can't run — the k6 HTTP numbers must be captured on the dev machine. The DB-tier harness needs only
Postgres, so it produced **real numbers on the #1 bottleneck now**. It runs each invoice in one
transaction with the JWT-sub claim set transaction-local — the same shape PostgREST uses — so the
advisory-lock hold time is realistic.

**DB-tier `save_invoice` results** (local Postgres 16, 40–50% write mix, 0 errors throughout):

| Scenario | Workers | Write thr | save p50 | save p95 | save p99 | read p95 |
|----------|--------:|----------:|---------:|---------:|---------:|---------:|
| Baseline (spread) | 4 | **688/s** | 4.5 ms | 9.0 ms | 12.1 ms | 0.8 ms |
| Spread | 16 | 576/s | 21 ms | 56 ms | 165 ms | 2.2 ms |
| **Concentrated (1 shop)** | 16 | **261/s** | 57 ms | 76 ms | 117 ms | 0.5 ms |
| Concentrated (1 shop) | 32 | 204/s | 135 ms | 264 ms | 343 ms | 0.7 ms |

> These are local, no-network numbers — treat the **shape**, not the absolute ms, as the signal.
> HTTP p50s on the dev machine will be higher (auth + PostgREST + network).

### Finding F-2 — advisory-lock serialization confirmed (by design; per-shop write ceiling)
Concentrating all writes on a single shop cuts `save_invoice` throughput ~2.2× vs spreading across
shops at 16 workers (261 vs 576/s), and **adding more workers makes it worse** (204/s at 32 workers,
p50 → 135 ms). This is exactly the `pg_advisory_xact_lock(shop_id‖fy)` behaviour predicted in the
plan: sequential per-`(shop, FY)` invoice numbering serialises a shop's writes. Reads are unaffected;
spreading across shops scales. **Implication:** a single very high-volume shop has a hard write
ceiling. Reasonable for the 20–200 bills/day ICP, but worth noting for outliers — M3 ramp will
locate the HTTP-tier knee.

### Finding F-3 — invariant checker had an ordering bug (fixed); data was actually sound
The first concurrency run flagged 11,232 `inventory_movement_running_balance` violations. Investigation
showed **zero** duplicate `quantity_after` per inventory (the lost-update signature) and every
inventory matching its terminal movement — i.e. the data was consistent; the **checker** was wrong.
It ordered the movement chain by `ctid`, which stops reflecting insertion order once the heap reuses
pages / transactions block on the advisory lock (neither `ctid` nor `transaction_timestamp` is a
reliable commit-order key). Replaced with **order-independent** checks: `inventory_no_duplicate_after`
(lost-update detector) + `inventory_final_is_terminal`. Re-run: **14/14 invariants PASS** over ~14k
concurrently-generated invoices. This hardening is exactly what the M4 concurrency gate needs.

## M3 results (knee sweep + stress/spike harness)

**Built:** `perf/k6/stress-ramp.js` (10→200 VU ramp, latency observed / only error-rate aborts),
`perf/k6/spike.js` (ramping-arrival-rate storefront burst + recovery). DB-tier engine refactored into
`perf/dbload/core.mjs`; added `perf/dbload/sweep.mjs` to map the throughput/latency knee.

**DB-tier knee sweep** (local PG16, 6 shops, 70% write mix, 6 s/step, 0 errors — read p95 in ms):

*Concentrated (all writes on ONE shop):*

| workers | 1 | 2 | 4 | 8 | 16 | 24 | 32 | 48 | 64 |
|---------|--:|--:|--:|--:|---:|---:|---:|---:|---:|
| W thr/s | 282 | **324** | 243 | 221 | 211 | 230 | 193 | 132 | 117 |
| W p95 ms | 5 | 8 | 20 | 43 | 124 | 145 | 223 | 600 | 991 |

*Spread (writes across 6 shops):*

| workers | 1 | 2 | 4 | 8 | 16 | 24 | 32 | 48 | 64 |
|---------|--:|--:|--:|--:|---:|---:|---:|---:|---:|
| W thr/s | 277 | 533 | 759 | **815** | 677 | 592 | 528 | 476 | 468 |
| W p95 ms | 6 | 6 | 11 | 25 | 94 | 175 | 279 | 432 | 622 |

### Finding F-4 — the write knee is per-shop and early; spreading gives ~2.5× headroom
- **One shop saturates at ~1–2 concurrent writers** (peak ≈324/s at 2), then throughput plateaus and
  *declines* while p95 climbs to ~1 s at 64 — the `save_invoice` advisory lock serialises a shop's
  writes, so extra concurrency just queues.
- **Spread across 6 shops peaks ≈815/s at 8 workers** (~2.5× the single-shop ceiling), i.e. it scales
  with shop count until the single local Postgres itself saturates (CPU/pool), then tapers.
- **Implication for the HTTP tier (M3 on dev machine):** the app's ceiling won't be VU count per se —
  it's *writes-per-shop* plus the Supabase pool. For the 20–200 bills/day ICP a single shop needs
  &lt;1 write/s, so this is comfortable; the risk is a synthetic single-shop storm, not real traffic.
  Run `perf/k6/stress-ramp.js` to confirm the HTTP knee and pool behaviour end-to-end.
- Absolute ms are local/no-network; the **curve shape and the ~2.5× spread advantage** are the signal.

### Integrity under sustained concurrency
The sweeps generated **43,270 invoices**; the (M2-hardened) invariant checker reported **14/14 PASS**
scoped to the run — no duplicate/gapped invoice numbers, totals/tax/credit/inventory all reconciled,
zero lost updates — strong evidence the advisory-lock + row-lock design is correct under load.
Cleanup restored pilot data (shops 3, invoices 0).

## M4 results (DB concurrency + RLS isolation) — the core gate

**Built:** `perf/rls/check.mjs` (RLS isolation, runnable here), `perf/k6/db-concurrency.js`
(same-shop HTTP storm), `perf/k6/rls-isolation.js` (HTTP isolation). The `authenticated`/`anon`
table grants Supabase provides were added to `perf/local-ci/bootstrap.sql` (via DEFAULT PRIVILEGES)
so RLS is actually exercisable in the Docker-less DB.

### Same-shop invoice storm (the GST-compliance gate)
32 concurrent writers, **100% writes**, one shop, 15 s → **3,805 invoices, 0 errors**:

| invoices on shop | distinct invoice_number | distinct sequence | max sequence |
|-----------------:|------------------------:|------------------:|-------------:|
| 3,805 | **3,805** | **3,805** | **3,805** |

Perfectly contiguous `1…3805` — **zero duplicate numbers, zero gaps** under worst-case contention.
The `pg_advisory_xact_lock(shop_id‖FY)` guarantees sequential per-`(shop, FY)` invoice numbering
(Rule 46 CGST requirement) even when hammered. Full invariant checker: **14/14 PASS**.

### RLS / tenant isolation — 10/10 PASS
Run as the `authenticated` role with a shop-A identity attempting shop-B access:

| Check | Result |
|-------|--------|
| own-shop products visible (control) | ✅ saw 6/6 |
| cross-shop products hidden | ✅ 0 visible |
| cross-shop customers hidden | ✅ 0 visible |
| cross-shop invoices hidden | ✅ 0 visible |
| cross-shop product INSERT blocked (RLS `WITH CHECK`) | ✅ rejected |
| cross-shop `save_invoice` blocked (`assert_authenticated_shop`) | ✅ "Unauthorized: user does not belong to shop …" |
| own-shop `save_invoice` works (no over-block) | ✅ succeeded |
| storefront `create_online_order` rejects foreign product | ✅ "Product … is not available for this shop" |
| `consent_logs` UPDATE blocked (DPDP append-only) | ✅ rejected |
| `consent_logs` DELETE blocked (DPDP append-only) | ✅ rejected |

**No tenant leakage found.** RLS enforces read isolation, the RPC guards enforce write isolation
(incl. the RLS-bypassing admin storefront path re-deriving ownership server-side), and consent
records are immutable. The HTTP-tier `perf/k6/rls-isolation.js` re-checks the same assertions with
real JWTs (`checks` threshold = 100%).

## M5 results (soak + failure/retry) — two findings

**Built:** `perf/failure/check.mjs` (failure/retry), `perf/dbload/soak.mjs` (segmented soak with
p95 + connection sampling).

### Failure / retry — 5/5 PASS
| Check | Result |
|-------|--------|
| idempotency (10 concurrent same-key checkouts) | ✅ exactly 1 order — 1 create + 9 replays, 1 stored row |
| `save_invoice` atomicity (fails mid-body) | ✅ no partial write (invoice count stable) |
| insufficient-stock online order | ✅ full rollback — no invoice/customer/consent residue |
| missing consent rejected | ✅ |
| invalid phone rejected | ✅ |

The idempotency result is the important one: rapid double-click / retry storms dedupe correctly via
the `(shop, key)` advisory lock + partial-unique index.

### Soak (compressed: 6 × 30s, 12 workers, spread)
| segment | 1 | 2 | 3 | 4 | 5 | 6 |
|---------|--:|--:|--:|--:|--:|--:|
| W thr/s | 396 | 358 | 316 | 285 | 270 | 245 |
| W p95 ms | 56 | 59 | 68 | 79 | 80 | 89 |
| active conns | 1 | 1 | 1 | 1 | 1 | 1 |

Throughput fell ~38% and p95 drifted +60% *within a 3-minute run* — not a connection leak (flat), but
a real degradation that led directly to **F-5**. (Caveat: the sampler reads connections between
segments when the load pool is closed, so this run doesn't test for a mid-segment connection leak —
the dev-machine k6 soak covers that.)

### Finding F-5 — `save_invoice` slows as a shop accumulates invoices (missing index) — HIGH
`save_invoice` and `create_online_order` compute the next invoice number with
`MAX(invoice_sequence) WHERE shop_id = ? AND financial_year = ?`. There is **no index ordered by
`invoice_sequence`** (the closest, `idx_invoices_shop_fy`, is ordered by `created_at`), so this
aggregates over *all* of a shop's invoices for the year — and it sits **inside the advisory-lock
critical section**, so it lengthens lock-hold time for every concurrent writer. Measured on a shop
with ~28k invoices:

| | plan | time | buffers |
|---|------|-----:|--------:|
| before | Aggregate over matching rows | 14.4 ms | 1,878 pages |
| after `idx_invoices_shop_fy_seq (shop_id, financial_year, invoice_sequence DESC)` | index lookup | **0.17 ms** | **6 pages** |

~85× faster, and O(1) regardless of history. In production a shop accrues invoices all financial
year (200/day ≈ 70k), so every bill would slow progressively. **Recommendation:** add
`CREATE INDEX idx_invoices_shop_fy_seq ON invoices (shop_id, financial_year, invoice_sequence DESC);`
(validated in the throwaway DB; not added to product migrations — say the word and I'll open it).

### Finding F-6 — DPDP right-to-erasure vs `consent_logs` immutability — MEDIUM
The `consent_logs_immutable` trigger (append-only, correct for DPDP audit) blocks **DELETE**, so a
hard `DELETE FROM shops/customers` **cascades into `consent_logs` and fails** — a customer/shop can't
be hard-deleted while consent rows exist. DPDP mandates *both* auditable consent *and* a right to
erasure, so the erasure path needs an explicit design (anonymise-in-place, or a privileged
purge that bypasses the trigger) rather than a naive cascade delete. Surfaced because the perf
cleanup itself hit it; `perf/seed/cleanup.mjs` now disables the trigger for **test-data** teardown
only (superuser, transaction-scoped).

## Scenario results log

> One block per run. Keep the raw k6 summary + the invariant-check verdict.

### M2 — Baseline
- Date / run-id: —
- VUs / duration: —
- Result vs thresholds: —
- Invariant check (before/after): —

### M2 — Sustained
- _pending_

### M3 — Stress / ramp
- Knee located at ~___ VUs: —
- Advisory-lock / pool observations: —

### M3 — Spike
- Recovery to baseline: —

### M4 — DB concurrency (same-shop storm)
- Duplicate/gapped invoice numbers: —
- Inventory / credit / spend reconciliation: —
- Deadlock / serialization-failure rate: —

### M4 — RLS / tenant isolation
- Cross-shop read attempts blocked: —
- Admin checkout `shop_id` validation: —
- `consent_logs` immutability: —

### M5 — Soak
- Duration: —
- Memory / connection drift: —
- Cron interplay: —

### M5 — Failure / retry
- Idempotency (`idempotency_key`): —
- Partial-write / rollback integrity: —

### M6 — Playwright flows (built; run on dev machine)
- POS keyboard billing: `perf/browser/pos-billing.spec.ts` — dev login → billing → product search (read path).
- Storefront checkout: `perf/browser/storefront-checkout.spec.ts` — add → consent → place order, asserts API 200 (no real WhatsApp).

---

## M6 results (browser flows)

**Built:** `perf/browser/playwright.config.ts` + `storefront-checkout.spec.ts` (public checkout, asserts
API 200, no real WhatsApp) + `pos-billing.spec.ts` (dev login → billing product search, read-only).
Run on the dev machine (`supabase start` + `npm run dev`). Selectors are grounded in the current
components; the app has no `data-testid`s (see follow-up R-4).

---

## Final go / no-go report

**Scope run in this engagement:** M0–M6. Everything executed against a **local, disposable Postgres**
(no production/staging ever contacted). The HTTP-tier k6 + Playwright scenarios are built and ready to
run on a dev machine with `supabase start`; the DB tier — where the architecture's real bottlenecks
and integrity guarantees live — was exercised directly here (up to ~43k invoices/run, ~56k in soak).

### Overall verdict: **GO, conditional on F-5.**
The core transactional design is **correct and safe under concurrency**: invoice numbering stays
perfectly sequential under a same-shop storm, tenant isolation holds at both the RLS and RPC layers,
and failure paths are atomic and idempotent. The one thing to fix before scaling is the missing
sequence index (F-5) — a one-line, additive change with ~85× measured effect on the hottest path.

### What passed (evidence)
- **Concurrency integrity:** 3,805 invoices on ONE shop under 32 concurrent writers → sequence
  `1…3805`, zero duplicates, zero gaps; ~43k more across the sweeps → invariants **14/14 PASS**. GST
  Rule-46 sequential numbering holds under worst-case contention (advisory lock is doing its job).
- **Tenant isolation:** 10/10 — RLS hides cross-shop reads; RPC guards + RLS `WITH CHECK` block
  cross-shop writes; the RLS-bypassing storefront path re-derives ownership; `consent_logs` immutable.
- **Failure/retry:** 5/5 — concurrent same-key checkouts dedupe to one order; `save_invoice` atomic;
  insufficient-stock rolls back fully; bad input rejected.
- **Data reconciliation:** totals, GST split, credit balances, loyalty spend/visits, inventory
  movement chains all reconcile after heavy load.

### Findings ledger

| ID | Sev | Finding | Recommendation |
|----|-----|---------|----------------|
| **F-5** | 🔴 High | `MAX(invoice_sequence)` next-number lookup has no `invoice_sequence`-ordered index and runs inside the advisory-lock critical section → per-shop write latency grows with yearly invoice count (14.4 ms/1878 buf at ~28k rows). | Add `CREATE INDEX idx_invoices_shop_fy_seq ON invoices (shop_id, financial_year, invoice_sequence DESC);` → 0.17 ms/6 buf. **Validated.** |
| **F-2 / F-4** | 🟡 Med | Per-shop write throughput is capped by the advisory lock (single shop saturates at ~1–2 writers; spreading gives ~2.5×). By design for sequential numbering. | Fine for the ICP (<1 write/s/shop). If a very high-volume single shop appears, consider a per-shop sequence/`nextval` strategy instead of `MAX+lock`. Re-check after F-5. |
| **F-6** | 🟡 Med | `consent_logs` append-only trigger blocks DELETE → hard cascade-deletion of a shop/customer fails; conflicts with DPDP right-to-erasure. | Design an explicit erasure path (anonymise-in-place, or privileged purge that bypasses the trigger + logs the erasure). |
| **F-1** | 🟢 Low | Pilot `supabase/seed.sql` customers carry denormalized `total_spent`/`visit_count` with no backing invoices (don't reconcile). | Derive those fields from transactions, or accept as demo-only data. |
| **F-3** | ✅ Fixed | Invariant checker's inventory chain check used `ctid` ordering → false positives under concurrency. | Replaced with order-independent checks (lost-update + terminal-state). Done in M2. |
| **cron** | 🟡 Med (unrun) | `GET /api/cron/campaigns` is N+1 (per rule → invoices → per-match dup check) + sequential WhatsApp sends → Vercel timeout risk as data grows. Not load-tested (needs the HTTP stack + a `find_campaign_matches` RPC). | Push matching into a single set-based SQL/RPC; batch/parallelise sends; add a timeout budget. Cover in the dev-machine soak. |

### Recommended follow-ups
- **R-1 (do first):** ship the F-5 index migration. *(I can open it on request.)*
- **R-2:** run the built HTTP-tier scenarios on a dev machine (`k6 baseline/sustained/stress/spike/
  db-concurrency/rls-isolation`, Playwright) to capture real network-inclusive latency and confirm the
  Supabase connection-pool ceiling; fill the HTTP reference table above.
- **R-3:** decide the DPDP erasure strategy (F-6).
- **R-4:** add `data-testid`s to checkout/billing controls to harden the Playwright flows.
- **R-5:** refactor the campaign cron to set-based matching + batched sends before it grows.

### Safety statement
No production or hosted environment was accessed; no real WhatsApp/SMS/email/payment was sent; all
data was synthetic and tagged; every run stayed within the ≤200-VU / ≤60-min caps and the >10%
error-rate abort gate (never tripped); all synthetic data was removed and pilot data verified intact
after each milestone.
