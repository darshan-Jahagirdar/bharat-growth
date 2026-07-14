// =============================================================================
// perf/failure/check.mjs — failure & retry behaviour (M5)
//
// Verifies the system degrades safely under retries and bad input, against the
// LOCAL database. Exit 0 = all pass, 1 = any fail.
//
//   1. idempotency (concurrent) — N simultaneous storefront checkouts with the
//      SAME idempotency_key create exactly ONE order; all return the same id.
//   2. atomicity — a save_invoice that fails mid-body leaves NO partial rows.
//   3. insufficient-stock — an over-quantity online order rolls back fully
//      (no invoice / customer / consent residue).
//   4. input validation — missing consent / bad phone are rejected.
//
// LOCAL-ONLY. Usage: node perf/failure/check.mjs --run-id m5
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const args = parseArgs();
const RUN_ID = args['run-id'] || env.PERF_RUN_ID;

const manifestPath = args.manifest && args.manifest !== true
  ? args.manifest : resolve(__dirname, '..', 'seed', `.manifest.${RUN_ID}.json`);
let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')); }
catch { console.error(`❌ Cannot read manifest ${manifestPath}. Seed first.`); process.exit(1); }

const shop = manifest.shops[0];
const results = [];
function record(name, pass, detail = '') {
  results.push({ pass });
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const expectThrow = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

async function main() {
  const cfg = pgConfigFromEnv(env);
  console.log(`\n🧪 failure / retry  run-id=${RUN_ID}  shop=${shop.id.slice(0, 8)}  target=${cfg.host}:${cfg.port}/${cfg.database}\n`);

  // ── 1. Concurrent idempotent checkout: same key, fired in parallel ──
  {
    const pool = new pg.Pool({ ...cfg, max: 10 });
    const key = randomUUID();
    const order = {
      shop_id: shop.id, customer_name: 'Retry Tester', customer_phone: '9999123123',
      payment_method: 'upi', data_consent: true, idempotency_key: key,
      items: [{ product_id: shop.products[0].id, quantity: 1 }],
    };
    const calls = Array.from({ length: 10 }, () =>
      pool.query(`SELECT create_online_order($1::jsonb) AS r`, [JSON.stringify(order)]).then((x) => x.rows[0].r));
    const settled = await Promise.allSettled(calls);
    const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
    const ids = new Set(ok.map((r) => r.order_id));
    const creates = ok.filter((r) => r.idempotent_replay === false).length;
    const stored = (await pool.query(
      `SELECT count(*)::int n FROM invoices WHERE shop_id=$1 AND idempotency_key=$2`, [shop.id, key])).rows[0].n;
    record('idempotency_concurrent_single_order',
      ids.size === 1 && stored === 1 && creates === 1,
      `${ok.length} calls → ${ids.size} distinct order, ${creates} create + ${ok.length - creates} replay, ${stored} row`);
    // cleanup this order (delete by key)
    await pool.query(`DELETE FROM invoices WHERE shop_id=$1 AND idempotency_key=$2`, [shop.id, key]);
    await pool.end();
  }

  const c = new pg.Client(cfg);
  await c.connect();

  // ── 2. Atomicity: save_invoice that fails mid-body writes nothing ──
  {
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [shop.owner_id]); // session-level
    const before = (await c.query(`SELECT count(*)::int n FROM invoices WHERE shop_id=$1`, [shop.id])).rows[0].n;
    // Item references a NON-existent product → RPC raises AFTER inserting the invoice header.
    const bad = {
      shop_id: shop.id, invoice_date: new Date().toISOString().slice(0, 10),
      customer_name: 'X', billing_state_code: shop.state_code,
      subtotal_paise: 100, cgst_total_paise: 9, sgst_total_paise: 9, total_paise: 118,
      payment_mode: 'cash', created_by: shop.owner_id,
    };
    const items = [{ product_id: randomUUID(), product_name: 'ghost', hsn_code: '40111000', quantity: 1,
      unit: 'piece', unit_price_paise: 100, taxable_amount_paise: 100, gst_rate_percent: 18,
      cgst_paise: 9, sgst_paise: 9, igst_paise: 0, total_paise: 118 }];
    const msg = await expectThrow(() => c.query(`SELECT save_invoice($1::jsonb,$2::jsonb,NULL)`,
      [JSON.stringify(bad), JSON.stringify(items)]));
    const after = (await c.query(`SELECT count(*)::int n FROM invoices WHERE shop_id=$1`, [shop.id])).rows[0].n;
    record('save_invoice_atomic_no_partial_write',
      msg !== null && after === before, msg ? `rejected & count stable (${before}→${after})` : 'NO ERROR — leaked');
    await c.query(`RESET request.jwt.claim.sub`);
  }

  // ── 3. Insufficient-stock online order rolls back completely ──
  {
    const tracked = shop.products.find((p) => p.is_stock_tracked) || shop.products[0];
    const invBefore = (await c.query(`SELECT count(*)::int n FROM invoices WHERE shop_id=$1`, [shop.id])).rows[0].n;
    const consBefore = (await c.query(`SELECT count(*)::int n FROM consent_logs WHERE shop_id=$1`, [shop.id])).rows[0].n;
    const order = {
      shop_id: shop.id, customer_name: 'Overbuyer', customer_phone: '9999444555',
      payment_method: 'upi', data_consent: true,
      items: [{ product_id: tracked.id, quantity: 150000 }], // > seeded stock (100000), within valid range
    };
    const msg = await expectThrow(() => c.query(`SELECT create_online_order($1::jsonb)`, [JSON.stringify(order)]));
    const invAfter = (await c.query(`SELECT count(*)::int n FROM invoices WHERE shop_id=$1`, [shop.id])).rows[0].n;
    const consAfter = (await c.query(`SELECT count(*)::int n FROM consent_logs WHERE shop_id=$1`, [shop.id])).rows[0].n;
    record('insufficient_stock_full_rollback',
      msg !== null && /Insufficient stock/i.test(msg) && invAfter === invBefore && consAfter === consBefore,
      msg ? `rejected; no invoice/consent residue` : 'NO ERROR — leaked');
  }

  // ── 4. Input validation rejects bad payloads ──
  {
    const noConsent = { shop_id: shop.id, customer_name: 'X', customer_phone: '9999000111',
      payment_method: 'upi', data_consent: false, items: [{ product_id: shop.products[0].id, quantity: 1 }] };
    const m1 = await expectThrow(() => c.query(`SELECT create_online_order($1::jsonb)`, [JSON.stringify(noConsent)]));
    record('reject_missing_consent', m1 !== null && /consent/i.test(m1), m1 ? 'rejected' : 'accepted (bad!)');

    const badPhone = { shop_id: shop.id, customer_name: 'X', customer_phone: '12',
      payment_method: 'upi', data_consent: true, items: [{ product_id: shop.products[0].id, quantity: 1 }] };
    const m2 = await expectThrow(() => c.query(`SELECT create_online_order($1::jsonb)`, [JSON.stringify(badPhone)]));
    record('reject_invalid_phone', m2 !== null && /phone/i.test(m2), m2 ? 'rejected' : 'accepted (bad!)');
  }

  await c.end();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${failed === 0 ? '✅ ALL FAILURE/RETRY CHECKS PASSED' : `❌ ${failed} CHECK(S) FAILED`}\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
