// =============================================================================
// perf/rls/check.mjs — multi-tenant / RLS isolation test (M4)
//
// Verifies tenant isolation against the LOCAL database by acting AS the
// `authenticated` role with a shop-A identity and proving shop-B data is
// invisible / unwritable, that the RPC tenant guards reject cross-shop calls,
// and that consent_logs is append-only. Exit 0 = all pass, 1 = any fail.
//
// Runs each check inside a transaction that is ROLLED BACK, so it is read-only
// in effect (no residual data). LOCAL-ONLY.
//
// Usage: node perf/rls/check.mjs --run-id m4
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';
import { buildInvoicePayload } from '../dbload/core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const args = parseArgs();
const RUN_ID = args['run-id'] || env.PERF_RUN_ID;

const manifestPath = args.manifest && args.manifest !== true
  ? args.manifest
  : resolve(__dirname, '..', 'seed', `.manifest.${RUN_ID}.json`);

let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')); }
catch { console.error(`❌ Cannot read manifest ${manifestPath}. Seed ≥2 shops first.`); process.exit(1); }
if ((manifest.shops?.length || 0) < 2) { console.error('❌ Need ≥2 shops in the manifest.'); process.exit(1); }

const shopA = manifest.shops[0];
const shopB = manifest.shops[1];
const userA = shopA.owner_id;

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass });
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function main() {
  const cfg = pgConfigFromEnv(env);
  const c = new pg.Client(cfg);
  await c.connect();
  console.log(`\n🔐 RLS / tenant isolation  run-id=${RUN_ID}  shopA=${shopA.id.slice(0, 8)} shopB=${shopB.id.slice(0, 8)}  ` +
    `target=${cfg.host}:${cfg.port}/${cfg.database}\n`);

  // Run fn AS the authenticated role with shop-A's JWT identity; always rollback.
  async function asAuthA(fn) {
    await c.query('BEGIN');
    try {
      await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userA]);
      await c.query('SET LOCAL ROLE authenticated');
      return await fn();
    } finally {
      await c.query('ROLLBACK');
    }
  }
  const expectThrow = async (fn) => {
    try { await fn(); return null; } catch (e) { return e.message; }
  };

  // Baseline (superuser) counts for shop A, to prove RLS returns exactly them.
  const ownCount = (await c.query(
    `SELECT count(*)::int n FROM products WHERE shop_id = $1`, [shopA.id])).rows[0].n;

  // ── Control: own-shop data IS visible ──
  await asAuthA(async () => {
    const n = (await c.query(`SELECT count(*)::int n FROM products`)).rows[0].n;
    record('own_shop_products_visible', n === ownCount && n > 0, `saw ${n} of own ${ownCount}`);
  });

  // ── Cross-shop reads are hidden by RLS ──
  await asAuthA(async () => {
    const p = (await c.query(`SELECT count(*)::int n FROM products WHERE shop_id = $1`, [shopB.id])).rows[0].n;
    record('cross_shop_products_hidden', p === 0, `shopB products visible: ${p}`);
  });
  await asAuthA(async () => {
    const n = (await c.query(`SELECT count(*)::int n FROM customers WHERE shop_id = $1`, [shopB.id])).rows[0].n;
    record('cross_shop_customers_hidden', n === 0, `shopB customers visible: ${n}`);
  });
  await asAuthA(async () => {
    const n = (await c.query(`SELECT count(*)::int n FROM invoices WHERE shop_id = $1`, [shopB.id])).rows[0].n;
    record('cross_shop_invoices_hidden', n === 0, `shopB invoices visible: ${n}`);
  });

  // ── Cross-shop write via direct INSERT is blocked (RLS WITH CHECK) ──
  await asAuthA(async () => {
    const msg = await expectThrow(() => c.query(
      `INSERT INTO products (id, shop_id, name, hsn_code, gst_rate_percent, unit_price_paise,
         selling_price_paise, unit, vertical_attrs, is_stock_tracked, low_stock_threshold, purchase_price_paise)
       VALUES ($1,$2,'HACK','40111000',18,100,100,'piece','{}'::jsonb,false,5,100)`, [randomUUID(), shopB.id]));
    record('cross_shop_product_insert_blocked', msg !== null, msg ? 'rejected' : 'INSERT SUCCEEDED (leak!)');
  });

  // ── Cross-shop write via save_invoice is blocked (assert_authenticated_shop) ──
  await asAuthA(async () => {
    const { invoice, items, loyalty } = buildInvoicePayload(shopB); // shop_id = B
    const msg = await expectThrow(() => c.query(`SELECT save_invoice($1::jsonb,$2::jsonb,$3::jsonb)`,
      [JSON.stringify(invoice), JSON.stringify(items), loyalty ? JSON.stringify(loyalty) : null]));
    record('cross_shop_save_invoice_blocked', msg !== null && /Unauthorized|does not belong/i.test(msg),
      msg ? msg.split('\n')[0] : 'save_invoice SUCCEEDED (leak!)');
  });

  // ── Control: own-shop save_invoice succeeds (RLS/guard doesn't over-block) ──
  await asAuthA(async () => {
    const { invoice, items, loyalty } = buildInvoicePayload(shopA);
    const msg = await expectThrow(() => c.query(`SELECT save_invoice($1::jsonb,$2::jsonb,$3::jsonb)`,
      [JSON.stringify(invoice), JSON.stringify(items), loyalty ? JSON.stringify(loyalty) : null]));
    record('own_shop_save_invoice_ok', msg === null, msg ? `unexpected error: ${msg.split('\n')[0]}` : 'succeeded');
  });

  // ── Storefront RPC re-derives ownership: shop A order with a shop B product is rejected ──
  await c.query('BEGIN');
  {
    const order = {
      shop_id: shopA.id, customer_name: 'X', customer_phone: '9999000000',
      payment_method: 'upi', data_consent: true,
      items: [{ product_id: shopB.products[0].id, quantity: 1 }], // foreign product
    };
    const msg = await expectThrow(() => c.query(`SELECT create_online_order($1::jsonb)`, [JSON.stringify(order)]));
    record('checkout_cross_shop_product_blocked', msg !== null && /not available for this shop/i.test(msg),
      msg ? msg.split('\n')[0] : 'checkout SUCCEEDED with foreign product (leak!)');
  }
  await c.query('ROLLBACK');

  // ── consent_logs is append-only (DPDP): UPDATE and DELETE are rejected ──
  await c.query('BEGIN');
  {
    const cust = (await c.query(`SELECT id FROM customers WHERE shop_id=$1 LIMIT 1`, [shopA.id])).rows[0];
    const ins = await c.query(
      `INSERT INTO consent_logs (shop_id, customer_id, purpose, status, consent_method)
       VALUES ($1,$2,'data_collection','granted','in_app') RETURNING id`, [shopA.id, cust.id]);
    const cid = ins.rows[0].id;
    const upd = await expectThrow(() => c.query(`UPDATE consent_logs SET status='revoked' WHERE id=$1`, [cid]));
    // A failed statement aborts the tx; reset with a savepoint-free re-begin.
    await c.query('ROLLBACK'); await c.query('BEGIN');
    const ins2 = await c.query(
      `INSERT INTO consent_logs (shop_id, customer_id, purpose, status, consent_method)
       VALUES ($1,$2,'data_collection','granted','in_app') RETURNING id`, [shopA.id, cust.id]);
    const del = await expectThrow(() => c.query(`DELETE FROM consent_logs WHERE id=$1`, [ins2.rows[0].id]));
    record('consent_logs_update_blocked', upd !== null && /append-only/i.test(upd), upd ? 'rejected' : 'UPDATE SUCCEEDED');
    record('consent_logs_delete_blocked', del !== null && /append-only/i.test(del), del ? 'rejected' : 'DELETE SUCCEEDED');
  }
  await c.query('ROLLBACK');

  await c.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${failed === 0 ? '✅ ALL ISOLATION CHECKS PASSED' : `❌ ${failed} ISOLATION CHECK(S) FAILED`}\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
