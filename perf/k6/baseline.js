// =============================================================================
// perf/k6/baseline.js — baseline load (M2)
//
// Low concurrency, realistic mix, to establish reference p50/p95/p99 per path
// through the HTTP stack (GoTrue JWT → PostgREST RPC/reads, + public storefront
// checkout). Start here before any heavier scenario.
//
// Prereqs (LOCAL): `supabase start`, `npm run dev`, and a seeded manifest.
// Run:
//   PERF_TARGET_URL=http://127.0.0.1:54321 PERF_ANON_KEY=<local-anon> \
//   PERF_APP_URL=http://127.0.0.1:3000 PERF_MANIFEST=perf/seed/.manifest.<run>.json \
//   k6 run perf/k6/baseline.js
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
    baseline: { executor: 'ramping-vus', startVUs: 1,
      stages: [{ duration: '30s', target: 10 }, { duration: '2m', target: 10 }, { duration: '30s', target: 0 }] },
  },
  thresholds: {
    // Abort the whole run if the error rate breaches the 10% safety gate.
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
    // ── Read: product catalogue (exercises RLS as authenticated user) ──
    const token = login(user.email, manifest.user_password);
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,selling_price_paise,gst_rate_percent` +
      `&shop_id=eq.${shop.id}&is_active=eq.true&limit=50`,
      { headers: authHeaders(token), tags: { op: 'product_read' } });
    tRead.add(res.timings.duration);
    check(res, { 'read 200': (x) => x.status === 200 });
  } else if (r < 0.85) {
    // ── Write: POS save_invoice RPC ──
    const token = login(user.email, manifest.user_password);
    const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/save_invoice`,
      JSON.stringify(buildInvoiceBody(shop)),
      { headers: authHeaders(token), tags: { op: 'save_invoice' } });
    tSave.add(res.timings.duration);
    check(res, { 'save 200': (x) => x.status === 200 });
  } else {
    // ── Public storefront checkout (no auth) ──
    const res = http.post(`${APP_URL}/api/storefront/checkout`,
      JSON.stringify(buildCheckoutBody(shop)),
      { headers: { 'Content-Type': 'application/json' }, tags: { op: 'checkout' } });
    tCheckout.add(res.timings.duration);
    check(res, { 'checkout 2xx': (x) => x.status >= 200 && x.status < 300 });
  }
}
