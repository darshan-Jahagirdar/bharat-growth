# perf/invariants/ — SQL data-integrity checker (M1)

**Not yet implemented — M0 placeholder.** Built at milestone M1.

`check.mjs` connects directly to the LOCAL Postgres (`54322`) and returns a PASS/FAIL verdict on the
invariants from the plan (§8). This — not latency — is the real pass/fail signal for the concurrency
and tenancy scenarios. Runs before and after every heavy scenario.

Invariants:
- zero duplicate invoice numbers per `(shop_id, financial_year)`; zero unexpected gaps;
- `Σ invoice_items.total_paise` reconciles to invoice totals;
- `inventory_movements.quantity_after` equals running stock;
- `customers.credit_balance_paise` = `Σ credit_ledger`;
- `customers.total_spent_paise` / `visit_count` match the invoice ledger;
- no cross-tenant leakage (every child row's `shop_id` matches parent);
- deadlock / serialization-failure rate ≈ 0.
