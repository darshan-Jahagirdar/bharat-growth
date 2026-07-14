# perf/seed/ — synthetic tenant generator (M1)

**Not yet implemented — M0 placeholder.** Built at milestone M1 (extra-care gate).

Planned:
- `seed.mjs` — deterministic, idempotent, `--dry-run`-capable generator. Every row tagged with a
  `perf_run_id` and `LOADTEST-` marker; synthetic phones from a reserved non-real range. Creates
  shops (mixed gst_type/vertical), owner + cashier users with known passwords, products across GST
  slabs, inventory, customers, back-dated invoices, tags + campaign_rules.
- `cleanup.mjs` — deletes **strictly** the rows matching a given `--run-id`. Reversible teardown.

Safety: runs only after `perf/guard/check-env.mjs` passes (local target). Pilot data in
`supabase/seed.sql` is never touched; `supabase db reset` is the full restore.
