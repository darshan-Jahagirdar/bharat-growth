# perf/ — BharatGrowth stress-test harness

Backend / DB / system stress harness. See `../docs/performance-test-plan.md` for the full plan and
`../docs/performance-progress.md` for live status.

## Golden rules

1. **LOCAL only.** Everything targets `supabase start` on `127.0.0.1`. `perf/guard/check-env.mjs`
   hard-aborts against any non-local host. Nothing hosted/staging/prod is ever contacted.
2. **No real side effects.** WhatsApp/SMS/email/payments run in **simulated** mode only.
3. **Reversible.** Synthetic data is tagged (`LOADTEST-` + a `perf_run_id`) and removed by
   `seed/cleanup.mjs`. `supabase db reset` is the always-available full restore.
4. **Start low, gate on green.** Each milestone is an approval gate; escalate only after the
   invariant checks pass. Caps: ≤ 200 VUs, ≤ 60 min/run.

## Layout

```
perf/
  README.md              ← this file
  .env.perf.example      ← copy to .env.perf (gitignored) and fill local values
  guard/
    check-env.mjs        ← local-only env-guard (M0, done)
  seed/                  ← M1: synthetic generator + reversible cleanup
  invariants/            ← M1: SQL data-integrity checker (PASS/FAIL gate)
  k6/                    ← M2–M5: load scenarios + shared lib/
  browser/               ← M6: narrow Playwright flows
```

## Milestones

| M | Deliverable | Runs load? |
|---|-------------|------------|
| M0 | docs + this skeleton + env-guard | No |
| M1 | seed + cleanup + invariant checker (tiny dataset) | Minimal |
| M2 | k6 auth helper + baseline + sustained | Yes |
| M3 | stress/ramp + spike | Yes |
| M4 | db-concurrency + rls-isolation | Yes |
| M5 | soak + failure/retry | Yes |
| M6 | Playwright flows + final report | Light |

## Preflight (safe, read-only)

```bash
supabase start
node perf/guard/check-env.mjs   # must print OK for a 127.0.0.1 target
```
