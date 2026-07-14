# perf/invariants/ — SQL data-integrity checker (M1) ✅

Implemented and validated at milestone M1. `check.mjs` connects directly to the LOCAL Postgres,
runs a battery of invariants, and prints a PASS/FAIL verdict (exit 0 = all pass, 1 = any fail).
This — not latency — is the real pass/fail signal for the concurrency and tenancy scenarios. Run it
before and after every heavy scenario.

```bash
node perf/invariants/check.mjs [--run-id "$PERF_RUN_ID"]   # scope to a run, or omit for all data
```

Invariants checked:
- `duplicate_invoice_numbers`, `duplicate_invoice_sequence`, `invoice_sequence_gaps` per `(shop, FY)`
- `invoice_total_vs_items`, `invoice_header_arithmetic`, `invoice_item_line_arithmetic`
- `tenant_isolation_invoice_items`, `tenant_isolation_credit_ledger` (child `shop_id` = parent)
- `credit_balance_reconciliation`, `total_spent_reconciliation`, `visit_count_reconciliation`
- `inventory_movement_running_balance` (chain, ordered by `ctid`), `inventory_final_matches_ledger`
- `negative_credit_balances`

**Scope note:** for the DB-concurrency gate, run **scoped to the load `--run-id`** — data generated
through the real RPCs reconciles cleanly. An unscoped run also flags the pre-existing pilot-seed
denormalization (see Finding F-1 in `docs/performance-progress.md`).
