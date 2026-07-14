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
| **M3** | Stress/ramp + spike (find the knee) | ⬜ Not started | ≤ 200 VU. |
| **M4** | DB concurrency (same-shop storm) + RLS isolation | ⬜ Not started | Invariant gate. |
| **M5** | Soak + failure/retry + idempotency | ⬜ Not started | ≤ 45 min. |
| **M6** | Narrow Playwright flows + final go/no-go report | ⬜ Not started | — |

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

### M6 — Playwright flows
- POS keyboard billing: —
- Storefront checkout: —

---

## Open questions / findings

- _(record hypotheses confirmed or refuted here as runs complete — e.g. whether the
  `(shop_id, financial_year, invoice_sequence)` index is needed, actual advisory-lock penalty, cron
  timeout margin)_

---

## Go / no-go summary (fill at M6)

- Overall verdict: —
- Must-fix before production load: —
- Recommended follow-ups: —
