// =============================================================================
// perf/k6/lib/config.js — shared config, manifest loader, request builders.
//
// Reads env (set on the CLI) + the seed manifest (open() at init). The manifest
// is produced by `node perf/seed/seed.mjs` and lists shops, user credentials,
// product ids/prices, and customers so k6 can build valid requests.
//
// Required env (LOCAL only):
//   PERF_TARGET_URL   local Supabase URL, e.g. http://127.0.0.1:54321
//   PERF_ANON_KEY     local anon key (from `supabase start`)
//   PERF_APP_URL      local Next dev server, e.g. http://127.0.0.1:3000
//   PERF_MANIFEST     path to the seed manifest json
// =============================================================================

const SUPABASE_URL = __ENV.PERF_TARGET_URL || 'http://127.0.0.1:54321';
const ANON_KEY = __ENV.PERF_ANON_KEY || '';
const APP_URL = __ENV.PERF_APP_URL || 'http://127.0.0.1:3000';
const MANIFEST_PATH = __ENV.PERF_MANIFEST || '../seed/.manifest.perf.json';

// Hard local-only guard — refuse to point k6 at anything hosted.
for (const [name, url] of [['PERF_TARGET_URL', SUPABASE_URL], ['PERF_APP_URL', APP_URL]]) {
  const host = (url.match(/^https?:\/\/([^:/]+)/) || [])[1] || '';
  if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(host)) {
    throw new Error(`SAFETY ABORT: ${name}=${url} is not local (host "${host}"). k6 perf runs local only.`);
  }
}

// open() must run at init (not inside default fn).
const manifest = JSON.parse(open(MANIFEST_PATH));

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }

// RFC-4122 v4 uuid (test-grade; used for per-attempt idempotency keys).
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Build a save_invoice RPC body from a manifest shop.
function buildInvoiceBody(shop) {
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
  const p_invoice = {
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
  let p_loyalty_entry = null;
  if (withCust && mode !== 'credit') {
    const points = Math.max(1, Math.floor(total / 10000));
    p_loyalty_entry = { customer_id: withCust.id, entry_type: 'earn', points, running_balance: points };
  }
  return { p_invoice, p_items: items, p_loyalty_entry };
}

// Build a storefront checkout body (public API, no auth).
function buildCheckoutBody(shop) {
  const cust = pick(shop.customers);
  const lineCount = 1 + rand(2);
  const items = [];
  for (let i = 0; i < lineCount; i++) {
    items.push({ product_id: pick(shop.products).id, quantity: 1 + rand(2) });
  }
  return {
    shop_id: shop.id, customer_name: cust.name, customer_phone: cust.phone_number,
    payment_method: 'upi', data_consent: true, items,
    idempotency_key: uuidv4(), // per-attempt: rapid retries dedupe to one order
  };
}

export {
  SUPABASE_URL, ANON_KEY, APP_URL, manifest, pick, rand, buildInvoiceBody, buildCheckoutBody,
};
