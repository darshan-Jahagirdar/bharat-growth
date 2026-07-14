# perf/k6/ — load scenarios (M2–M5)

**Not yet implemented — M0 placeholder.** Built across milestones M2–M5.

Planned scripts (each starts low, uses k6 `thresholds` to auto-abort on breach):
- `lib/auth.js`, `lib/config.js` — shared JWT minting (local GoTrue) + request mix helpers.
- `baseline.js` (M2), `sustained.js` (M2)
- `stress-ramp.js` (M3), `spike.js` (M3)
- `db-concurrency.js` (M4) — same-shop invoice storm, `rls-isolation.js` (M4)
- `soak.js` (M5)

All target the local stack; WhatsApp/payments in simulated mode. Caps: ≤ 200 VUs, ≤ 60 min/run.
