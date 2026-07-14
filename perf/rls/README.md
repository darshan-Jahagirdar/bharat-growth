# perf/rls/ — multi-tenant / RLS isolation test (M4)

`check.mjs` verifies tenant isolation directly against the LOCAL Postgres by acting **as the
`authenticated` role** with a shop-A identity (`request.jwt.claim.sub` = shop-A owner) and proving
shop-B data is invisible and unwritable. Every check runs in a rolled-back transaction (read-only in
effect). Exit 0 = all pass, 1 = any leak.

```bash
node perf/seed/seed.mjs --run-id demo --shops 2   # need ≥2 shops
node perf/rls/check.mjs --run-id demo
```

Checks: own-shop data visible (control); cross-shop products/customers/invoices hidden by RLS;
cross-shop `INSERT` blocked (RLS `WITH CHECK`); cross-shop `save_invoice` blocked
(`assert_authenticated_shop`); own-shop `save_invoice` still works (no over-block); storefront
`create_online_order` rejects a foreign product; `consent_logs` `UPDATE`/`DELETE` blocked (DPDP
append-only trigger).

The HTTP-tier equivalent is `perf/k6/rls-isolation.js` (same assertions over PostgREST with a real
JWT), for the dev machine.
