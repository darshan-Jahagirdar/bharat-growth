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
| **M1** | Seed generator + reversible cleanup + SQL invariant checker (extra-care gate) | ⏳ Awaiting approval | Tiny-dataset validation only. |
| **M2** | k6 auth helper + baseline & sustained | ⬜ Not started | Needs M1 green. |
| **M3** | Stress/ramp + spike (find the knee) | ⬜ Not started | ≤ 200 VU. |
| **M4** | DB concurrency (same-shop storm) + RLS isolation | ⬜ Not started | Invariant gate. |
| **M5** | Soak + failure/retry + idempotency | ⬜ Not started | ≤ 45 min. |
| **M6** | Narrow Playwright flows + final go/no-go report | ⬜ Not started | — |

Legend: ✅ done · ⏳ awaiting approval / in progress · ⬜ not started · ❌ blocked/failed

---

## Environment snapshot (to fill at M1)

| Item | Value |
|------|-------|
| Host machine (CPU / RAM) | _tbd_ |
| Postgres version (local) | _tbd_ |
| Supabase CLI version | _tbd_ |
| k6 version | _tbd_ |
| Shops / users / products / customers seeded | _tbd_ |
| `perf_run_id` of latest seed | _tbd_ |

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
