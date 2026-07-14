// =============================================================================
// perf/k6/db-concurrency.js — same-shop invoice storm (M4, HTTP tier)
//
// Every VU hammers save_invoice on ONE shop (manifest.shops[0]) to maximise
// advisory-lock contention over the real HTTP stack. The pass/fail signal is NOT
// latency — it is data integrity: after the run, execute the invariant checker
// and confirm zero duplicate/gapped invoice numbers.
//
//   k6 run perf/k6/db-concurrency.js
//   node perf/invariants/check.mjs --run-id <run>      # ← the real gate
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SUPABASE_URL, manifest, pick, buildInvoiceBody } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const tSave = new Trend('save_invoice_ms', true);
const shop = manifest.shops[0]; // pin to ONE shop

export const options = {
  scenarios: {
    storm: { executor: 'ramping-vus', startVUs: 5,
      stages: [{ duration: '30s', target: 40 }, { duration: '2m', target: 40 }, { duration: '20s', target: 0 }] },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true }],
    'save_invoice_ms': ['p(95)<2000'], // contention expected; integrity is the real gate
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const user = pick(shop.users);
  const token = login(user.email, manifest.user_password);
  const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/save_invoice`,
    JSON.stringify(buildInvoiceBody(shop)),
    { headers: authHeaders(token), tags: { op: 'save_invoice' } });
  tSave.add(res.timings.duration);
  check(res, { 'save 200': (x) => x.status === 200 });
}
