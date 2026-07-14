// =============================================================================
// perf/k6/spike.js — spike test (M3)
//
// Models a sudden storefront burst (e.g. a WhatsApp campaign blast): a low
// steady baseline, then a sharp spike in arrival rate, a short hold, and a drop
// back to baseline — to observe cold-start behaviour and whether the system
// recovers to its baseline latency afterwards.
//
// Uses ramping-arrival-rate (open model) so the spike is a request-rate surge
// independent of how fast responses come back — the realistic shape for a burst.
// Storefront checkout is the public, unauthenticated, spikiest path.
//
// Run (LOCAL, after seed + supabase start + npm run dev):
//   PERF_TARGET_URL=... PERF_ANON_KEY=... PERF_APP_URL=... PERF_MANIFEST=... \
//   k6 run perf/k6/spike.js
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { APP_URL, manifest, pick, buildCheckoutBody } from './lib/config.js';

const tCheckout = new Trend('checkout_ms', true);

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 5, timeUnit: '1s',
      preAllocatedVUs: 50, maxVUs: 300,
      stages: [
        { duration: '30s', target: 5 },    // calm baseline
        { duration: '10s', target: 200 },  // sudden spike
        { duration: '30s', target: 200 },  // hold the burst
        { duration: '10s', target: 5 },    // drop
        { duration: '40s', target: 5 },    // observe recovery to baseline
      ],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true }],
    'checkout_ms': ['p(95)<1200'],   // recorded; peak may breach during the burst
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const shop = pick(manifest.shops);
  const res = http.post(`${APP_URL}/api/storefront/checkout`,
    JSON.stringify(buildCheckoutBody(shop)),
    { headers: { 'Content-Type': 'application/json' }, tags: { op: 'checkout' } });
  tCheckout.add(res.timings.duration);
  check(res, { 'checkout 2xx': (x) => x.status >= 200 && x.status < 300 });
}
