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
| **M2** | k6 auth helper + baseline & sustained | ⬜ Not started | Needs M1 green. |
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

## Reference metrics (baseline — fill at M2)

| Path | p50 | p95 | p99 | error % | notes |
|------|-----|-----|-----|---------|-------|
| POS `save_invoice` | — | — | — | — | |
| Reads (catalogue/customer) | — | — | — | — | |
| Storefront checkout | — | — | — | — | |
| Receipt send (simulated) | — | — | — | — | |

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
