// =============================================================================
// perf/dbload/run.mjs — DB-tier load harness (M2 baseline)
//
// Drives the REAL save_invoice RPC (and representative reads) directly against
// the local Postgres under controlled concurrency, and reports latency
// percentiles + throughput. Its purpose is to measure the central bottleneck —
// the per-shop advisory lock in save_invoice — WITHOUT needing the HTTP stack
// (GoTrue/PostgREST/Next), which can't run in a Docker-less environment.
//
// It mirrors production's execution shape: each invoice runs in ONE transaction
// with the JWT-sub claim set as a transaction-local GUC (exactly how PostgREST
// invokes the SECURITY DEFINER RPC), so the advisory-lock hold time is realistic.
//
//   --mode spread        each op hits a RANDOM shop (locks rarely collide)
//   --mode concentrated  every op hits ONE shop (advisory lock always collides)
//
// LOCAL-ONLY (aborts on non-127.0.0.1). Reads a seed manifest for valid ids.
//
// Usage:
//   node perf/dbload/run.mjs --run-id m2seed --mode spread --workers 16 --duration 10
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const args = parseArgs();

const RUN_ID = args['run-id'] || env.PERF_RUN_ID;
const MODE = args.mode === 'concentrated' ? 'concentrated' : 'spread';
const WORKERS = Number(args.workers || 16);
const DURATION_S = Number(args.duration || 10);
const WRITE_RATIO = args['write-ratio'] !== undefined ? Number(args['write-ratio']) : 0.4;

const manifestPath = args.manifest && args.manifest !== true
  ? args.manifest
  : resolve(__dirname, '..', 'seed', `.manifest.${RUN_ID}.json`);

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
  console.error(`❌ Cannot read manifest ${manifestPath}. Seed first: node perf/seed/seed.mjs --run-id ${RUN_ID}`);
  process.exit(1);
}
if (!manifest.shops?.length) {
  console.error('❌ Manifest has no shops.');
  process.exit(1);
}

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

/** Build a save_invoice payload for one shop from the manifest. */
function buildInvoicePayload(shop) {
  const lineCount = 1 + rand(3);
  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, total = 0;
  const items = [];
  for (let i = 0; i < lineCount; i++) {
    const p = pick(shop.products);
    const qty = 1 + rand(3);
    const taxable = Math.round(qty * p.selling_price_paise);
    const rate = shop.gst_type === 'composition' ? 0 : p.gst_rate_percent;
    const gst = Math.round((taxable * rate) / 100);
    const cgst = Math.round(gst / 2);
    const sgst = gst - cgst;
    const lineTotal = taxable + cgst + sgst;
    subtotal += taxable; cgstTotal += cgst; sgstTotal += sgst; total += lineTotal;
    items.push({
      product_id: p.id, product_name: p.name, hsn_code: p.hsn_code, quantity: qty, unit: p.unit,
      unit_price_paise: p.selling_price_paise, discount_paise: 0, taxable_amount_paise: taxable,
      gst_rate_percent: rate, cgst_paise: cgst, sgst_paise: sgst, igst_paise: 0, total_paise: lineTotal,
    });
  }
  // ~40% attach a customer; rotate modes to exercise credit + loyalty paths.
  const withCust = Math.random() < 0.4 ? pick(shop.customers) : null;
  const mode = !withCust ? 'cash' : (Math.random() < 0.5 ? 'credit' : 'upi');
  const invoice = {
    shop_id: shop.id, invoice_date: new Date().toISOString().slice(0, 10),
    document_type: shop.gst_type === 'composition' ? 'bill_of_supply' : 'tax_invoice',
    customer_id: withCust ? withCust.id : null,
    customer_name: withCust ? withCust.name : 'Walk-in',
    customer_phone: withCust ? withCust.phone_number : null,
    billing_state_code: shop.state_code, is_inter_state: false,
    subtotal_paise: subtotal, cgst_total_paise: cgstTotal, sgst_total_paise: sgstTotal,
    igst_total_paise: 0, discount_paise: 0, round_off_paise: 0, total_paise: total,
    payment_mode: mode, created_by: shop.owner_id,
  };
  let loyalty = null;
  if (withCust && mode !== 'credit') {
    const points = Math.max(1, Math.floor(total / 10000));
    loyalty = { customer_id: withCust.id, entry_type: 'earn', points, running_balance: points };
  }
  return { invoice, items, loyalty };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  const cfg = pgConfigFromEnv(env);
  const pool = new pg.Pool({ ...cfg, max: WORKERS });
  const oneShop = manifest.shops[0];

  const latW = [], latR = [];
  let errors = 0, opsW = 0, opsR = 0;
  const deadline = Date.now() + DURATION_S * 1000;

  console.log(`\n⚙️  DB-tier load  mode=${MODE}  workers=${WORKERS}  duration=${DURATION_S}s  ` +
    `write-ratio=${WRITE_RATIO}  target=${cfg.host}:${cfg.port}/${cfg.database}`);
  console.log(`   shops=${manifest.shops.length} (concentrated targets: ${oneShop.business_type}/${oneShop.gst_type})\n`);

  async function worker() {
    const client = await pool.connect();
    try {
      while (Date.now() < deadline) {
        const isWrite = Math.random() < WRITE_RATIO;
        const shop = MODE === 'concentrated' ? oneShop : pick(manifest.shops);
        const t0 = process.hrtime.bigint();
        try {
          if (isWrite) {
            const { invoice, items, loyalty } = buildInvoicePayload(shop);
            await client.query('BEGIN');
            await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [shop.owner_id]);
            await client.query(`SELECT save_invoice($1::jsonb, $2::jsonb, $3::jsonb)`,
              [JSON.stringify(invoice), JSON.stringify(items), loyalty ? JSON.stringify(loyalty) : null]);
            await client.query('COMMIT');
            latW.push(Number(process.hrtime.bigint() - t0) / 1e6);
            opsW++;
          } else {
            // Representative read (product catalogue for a shop).
            await client.query(
              `SELECT id, name, selling_price_paise, gst_rate_percent
               FROM products WHERE shop_id = $1 AND is_active = true LIMIT 50`, [shop.id]);
            latR.push(Number(process.hrtime.bigint() - t0) / 1e6);
            opsR++;
          }
        } catch (e) {
          errors++;
          await client.query('ROLLBACK').catch(() => {});
          if (errors <= 3) console.error(`   op error: ${e.message}`);
        }
      }
    } finally {
      client.release();
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const elapsed = (Date.now() - started) / 1000;
  await pool.end();

  const rep = (label, lat, ops) => {
    const s = lat.slice().sort((a, b) => a - b);
    console.log(
      `  ${label.padEnd(18)} ops=${String(ops).padStart(6)}  thr=${(ops / elapsed).toFixed(1).padStart(7)}/s  ` +
      `p50=${percentile(s, 50).toFixed(1)}ms  p95=${percentile(s, 95).toFixed(1)}ms  ` +
      `p99=${percentile(s, 99).toFixed(1)}ms  max=${(s[s.length - 1] || 0).toFixed(1)}ms`);
  };

  console.log('  ── results ─────────────────────────────────────────────────────────');
  rep('save_invoice (W)', latW, opsW);
  rep('product read (R)', latR, opsR);
  const totalOps = opsW + opsR;
  const errRate = totalOps + errors > 0 ? (errors / (totalOps + errors)) * 100 : 0;
  console.log(`  ${''.padEnd(18)} total=${totalOps}  errors=${errors} (${errRate.toFixed(2)}%)  wall=${elapsed.toFixed(1)}s`);
  console.log(`  ${errRate > 10 ? '❌ ERROR RATE > 10% — safety threshold breached' : '✅ error rate within 10% gate'}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
