// =============================================================================
// perf/k6/sustained.js — sustained load (M2)
//
// ~50 VUs holding steady for 10 minutes with the realistic mix, to check
// steady-state stability: no latency creep, no error growth, no leak. Same
// request builders and thresholds as baseline; compare p95 against the baseline
// reference (plan §8: no > 25% regression).
//
// Run (LOCAL, after seeding + supabase start + npm run dev):
//   PERF_TARGET_URL=... PERF_ANON_KEY=... PERF_APP_URL=... PERF_MANIFEST=... \
//   k6 run perf/k6/sustained.js
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { SUPABASE_URL, APP_URL, manifest, pick, buildInvoiceBody, buildCheckoutBody } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const tSave = new Trend('save_invoice_ms', true);
const tRead = new Trend('product_read_ms', true);
const tCheckout = new Trend('checkout_ms', true);

export const options = {
  scenarios: {
    sustained: { executor: 'ramping-vus', startVUs: 5,
      stages: [{ duration: '1m', target: 50 }, { duration: '10m', target: 50 }, { duration: '1m', target: 0 }] },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true }],
    'save_invoice_ms': ['p(95)<800', 'p(99)<1500'],
    'product_read_ms': ['p(95)<400'],
    'checkout_ms': ['p(95)<1200'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const shop = pick(manifest.shops);
  const user = pick(shop.users);
  const r = Math.random();

  if (r < 0.55) {
    const token = login(user.email, manifest.user_password);
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,selling_price_paise,gst_rate_percent` +
      `&shop_id=eq.${shop.id}&is_active=eq.true&limit=50`,
      { headers: authHeaders(token), tags: { op: 'product_read' } });
    tRead.add(res.timings.duration);
    check(res, { 'read 200': (x) => x.status === 200 });
  } else if (r < 0.85) {
    const token = login(user.email, manifest.user_password);
    const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/save_invoice`,
      JSON.stringify(buildInvoiceBody(shop)),
      { headers: authHeaders(token), tags: { op: 'save_invoice' } });
    tSave.add(res.timings.duration);
    check(res, { 'save 200': (x) => x.status === 200 });
  } else {
    const res = http.post(`${APP_URL}/api/storefront/checkout`,
      JSON.stringify(buildCheckoutBody(shop)),
      { headers: { 'Content-Type': 'application/json' }, tags: { op: 'checkout' } });
    tCheckout.add(res.timings.duration);
    check(res, { 'checkout 2xx': (x) => x.status >= 200 && x.status < 300 });
  }
}
