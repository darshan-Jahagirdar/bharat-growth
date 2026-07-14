# perf/dbload/ — DB-tier load harness

`run.mjs` drives the real `save_invoice` RPC (and representative reads) directly
against the local Postgres under controlled concurrency, and reports latency
percentiles + throughput. It measures the central bottleneck — the per-shop
advisory lock — **without** needing the HTTP stack (GoTrue/PostgREST/Next), so it
runs anywhere there's a local Postgres (incl. Docker-less CI).

It mirrors production's execution shape: each invoice runs in one transaction with
the JWT-sub claim set as a transaction-local GUC (exactly how PostgREST invokes the
SECURITY DEFINER RPC), so advisory-lock hold time is realistic.

```bash
node perf/seed/seed.mjs --run-id demo --shops 3           # produces the manifest
node perf/dbload/run.mjs --run-id demo --mode spread       --workers 16 --duration 10
node perf/dbload/run.mjs --run-id demo --mode concentrated --workers 16 --duration 10
node perf/invariants/check.mjs --run-id demo               # integrity after load
```

- `--mode spread` — each op hits a random shop (locks rarely collide).
- `--mode concentrated` — every op hits ONE shop (advisory lock always collides) →
  isolates the serialization penalty.
- `--workers`, `--duration` (s), `--write-ratio` (default 0.4).

LOCAL-only (aborts on non-127.0.0.1). Not a replacement for the k6 HTTP scenarios —
it isolates the DB tier; k6 measures the full request path.
