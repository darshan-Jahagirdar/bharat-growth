// =============================================================================
// perf/k6/rls-isolation.js — multi-tenant / RLS isolation over HTTP (M4)
//
// Correctness test (not a load test): a shop-A JWT must NOT be able to read or
// write shop-B data through PostgREST. Low volume, many checks. Any failed check
// is a tenant-isolation leak.
//
//   k6 run perf/k6/rls-isolation.js
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { SUPABASE_URL, manifest, buildInvoiceBody } from './lib/config.js';
import { login, authHeaders } from './lib/auth.js';

const shopA = manifest.shops[0];
const shopB = manifest.shops[1];

export const options = {
  scenarios: { rls: { executor: 'shared-iterations', vus: 4, iterations: 40, maxDuration: '1m' } },
  thresholds: {
    // Every isolation assertion must hold; zero tolerance.
    checks: ['rate==1.0'],
  },
};

export default function () {
  const userA = shopA.users[0];
  const token = login(userA.email, manifest.user_password);
  const h = authHeaders(token);

  // Control: shop A can read its own products.
  const own = http.get(
    `${SUPABASE_URL}/rest/v1/products?select=id&shop_id=eq.${shopA.id}&limit=5`, { headers: h });
  check(own, { 'A reads own products (non-empty)': (r) => r.status === 200 && r.json().length > 0 });

  // Isolation: shop A querying shop B's products must come back EMPTY (RLS filters).
  const cross = http.get(
    `${SUPABASE_URL}/rest/v1/products?select=id&shop_id=eq.${shopB.id}&limit=5`, { headers: h });
  check(cross, { 'A cannot see B products (empty)': (r) => r.status === 200 && r.json().length === 0 });

  // Isolation: shop A querying B's customers/invoices must be empty too.
  const custB = http.get(
    `${SUPABASE_URL}/rest/v1/customers?select=id&shop_id=eq.${shopB.id}&limit=5`, { headers: h });
  check(custB, { 'A cannot see B customers (empty)': (r) => r.status === 200 && r.json().length === 0 });

  // Isolation: shop A writing an invoice under shop B must be rejected by the RPC guard.
  const body = buildInvoiceBody(shopB); // p_invoice.shop_id = B
  const write = http.post(`${SUPABASE_URL}/rest/v1/rpc/save_invoice`, JSON.stringify(body), { headers: h });
  check(write, { 'A cannot save_invoice under B (4xx)': (r) => r.status >= 400 && r.status < 500 });
}
