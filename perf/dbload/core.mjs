// =============================================================================
// perf/dbload/core.mjs — reusable DB-tier load engine (shared by run.mjs + sweep.mjs)
// =============================================================================

import pg from 'pg';

export const rand = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[rand(arr.length)];

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/** Build a save_invoice payload for one manifest shop. */
export function buildInvoicePayload(shop) {
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

/**
 * Run a fixed-duration concurrent load and return latency/throughput stats.
 * opts: { cfg, manifest, mode, workers, durationS, writeRatio }
 */
export async function runLoad({ cfg, manifest, mode, workers, durationS, writeRatio }) {
  const pool = new pg.Pool({ ...cfg, max: workers });
  const oneShop = manifest.shops[0];
  const latW = [], latR = [];
  let errors = 0, opsW = 0, opsR = 0;
  const deadline = Date.now() + durationS * 1000;

  async function worker() {
    const client = await pool.connect();
    try {
      while (Date.now() < deadline) {
        const isWrite = Math.random() < writeRatio;
        const shop = mode === 'concentrated' ? oneShop : pick(manifest.shops);
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
  await Promise.all(Array.from({ length: workers }, worker));
  const elapsed = (Date.now() - started) / 1000;
  await pool.end();

  const sortW = latW.slice().sort((a, b) => a - b);
  const sortR = latR.slice().sort((a, b) => a - b);
  const totalOps = opsW + opsR;
  return {
    elapsed, opsW, opsR, errors,
    errRate: totalOps + errors > 0 ? (errors / (totalOps + errors)) * 100 : 0,
    write: { thr: opsW / elapsed, p50: percentile(sortW, 50), p95: percentile(sortW, 95),
      p99: percentile(sortW, 99), max: sortW[sortW.length - 1] || 0 },
    read: { thr: opsR / elapsed, p50: percentile(sortR, 50), p95: percentile(sortR, 95),
      p99: percentile(sortR, 99), max: sortR[sortR.length - 1] || 0 },
  };
}
