# perf/seed/ — synthetic tenant generator (M1) ✅

Implemented and validated at milestone M1.

- **`seed.mjs`** — deterministic, idempotent, `--dry-run`-capable generator. Every shop is tagged
  `shops.settings->>'perf_run_id' = <run-id>` and named `LOADTEST-…`; synthetic phones use a
  reserved `9999……` range. Creates shops (mixed gst_type/vertical), owner + cashier users
  (`auth.users` + `auth.identities` + `public.users`, known password for JWT minting), products
  across GST slabs, inventory, customers, tags + `campaign_rules`, and back-dated invoice history
  generated through the **real `save_invoice` RPC** (so cross-table data is realistic and
  reconcilable). `--dry-run` runs the whole insert path in one transaction and ROLLS BACK.
- **`cleanup.mjs`** — deletes **strictly** the shops for a `--run-id`; all `shop_id` child rows
  CASCADE away, then the matching `auth.users`/`auth.identities` are removed. `--dry-run` reports
  the exact counts it would delete.

```bash
node perf/seed/seed.mjs   --run-id "$PERF_RUN_ID" --shops 50 [--dry-run]
node perf/seed/cleanup.mjs --run-id "$PERF_RUN_ID" [--dry-run]
```

Safety: LOCAL-only (aborts on non-127.0.0.1). Pilot data in `supabase/seed.sql` is never touched;
`supabase db reset` is the full restore. Config via `perf/.env.perf` (`PERF_DB_*`, `PERF_RUN_ID`,
`PERF_USER_PASSWORD`).
