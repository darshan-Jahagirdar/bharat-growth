# perf/failure/ — failure & retry behaviour (M5)

`check.mjs` verifies the system degrades safely under retries and bad input, against the LOCAL
database. Exit 0 = all pass, 1 = any fail.

```bash
node perf/seed/seed.mjs --run-id demo --shops 2
node perf/failure/check.mjs --run-id demo
```

Checks:
- **idempotency (concurrent)** — 10 simultaneous storefront checkouts with the same
  `idempotency_key` create exactly ONE order (1 create + 9 replays, 1 stored row).
- **atomicity** — a `save_invoice` that fails mid-body (item references a non-existent product,
  which raises *after* the invoice header insert) leaves NO partial rows.
- **insufficient stock** — an over-quantity online order rolls back completely (no invoice /
  customer / consent residue).
- **input validation** — missing consent and invalid phone are rejected by the RPC.

The compressed soak lives in `perf/dbload/soak.mjs` (segmented load sampling p95 + active
connections to detect latency creep / connection leak).
