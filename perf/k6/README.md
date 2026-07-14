# perf/k6/ — HTTP load scenarios

k6 drives the real HTTP stack: GoTrue password-grant JWT → PostgREST RPC/reads,
plus the public storefront checkout Next route. Runs on a **dev machine** with the
local Supabase stack + Next dev server up (it can't run in a Docker-less container).

## Implemented (M2)
- `lib/config.js` — env + manifest loader, local-only guard, request builders.
- `lib/auth.js` — GoTrue password login with per-VU token cache.
- `baseline.js` — ramp to 10 VUs, realistic mix, reference p50/p95/p99.
- `sustained.js` — 50 VUs for 10 min, steady-state stability.

## Planned (M3–M4)
- `stress-ramp.js`, `spike.js` (M3) · `db-concurrency.js`, `rls-isolation.js` (M4)

## Run (LOCAL)
```bash
supabase start            # local Supabase (:54321)
npm run dev               # Next dev server (:3000)
node perf/seed/seed.mjs --run-id demo --shops 50   # writes perf/seed/.manifest.demo.json

PERF_TARGET_URL=http://127.0.0.1:54321 \
PERF_ANON_KEY=<local-anon-key> \
PERF_APP_URL=http://127.0.0.1:3000 \
PERF_MANIFEST=perf/seed/.manifest.demo.json \
k6 run perf/k6/baseline.js
```
Thresholds auto-abort the run if the error rate exceeds 10% (plan §8). All targets
must be `127.0.0.1`/`localhost` or the scripts refuse to start.
