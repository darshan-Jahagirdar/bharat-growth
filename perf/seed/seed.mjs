// =============================================================================
// perf/seed/seed.mjs — synthetic tenant generator (M1)
//
// Creates clearly-tagged, fully-reversible synthetic tenants for load testing:
//   shops (auth users + public.users owner/cashiers), products (+inventory),
//   customers, tags + campaign_rules, and back-dated invoice history generated
//   through the REAL save_invoice RPC (so cross-table data is realistic).
//
// SAFETY:
//   - LOCAL-ONLY: aborts unless the DB host is 127.0.0.1/localhost.
//   - Every shop is tagged shops.settings->>'perf_run_id' = <run-id> and named
//     "LOADTEST-…"; all child rows hang off those shops (shop_id FKs CASCADE),
//     so cleanup.mjs removes exactly and only this run's data.
//   - --dry-run executes the full insert inside a transaction and ROLLS BACK,
//     writing nothing while still proving the SQL runs end-to-end.
//
// Usage:
//   node perf/seed/seed.mjs --run-id 20260714-01 [--shops 3] [--cashiers 2]
//        [--products 8] [--customers 10] [--history 6] [--dry-run]
// =============================================================================

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs, LOADTEST_PREFIX } from '../lib/env.mjs';

const env = loadEnv();
const args = parseArgs();

const RUN_ID = args['run-id'] || env.PERF_RUN_ID;
if (!RUN_ID || RUN_ID === true) {
  console.error('❌ --run-id <id> is required (or set PERF_RUN_ID). Tags & cleanup key off it.');
  process.exit(1);
}
const DRY = Boolean(args['dry-run']);
const N_SHOPS = Number(args.shops || 3);
const N_CASHIERS = Number(args.cashiers || 2);
const N_PRODUCTS = Number(args.products || 8);
const N_CUSTOMERS = Number(args.customers || 10);
const N_HISTORY = Number(args.history || 6);
const USER_PW = env.PERF_USER_PASSWORD || 'loadtest-pass-123';

const STATES = ['27', '29', '09', '24', '06', '07'];
const VERTICALS = [
  { business_type: 'tyre_shop', gst_type: 'regular' },
  { business_type: 'sweet_stall', gst_type: 'composition' },
  { business_type: 'garment_store', gst_type: 'regular' },
];
const GST_SLABS = [5, 12, 18, 28];
const SEGMENTS = ['new', 'regular', 'vip'];

const pad = (n, w) => String(n).padStart(w, '0');
// Valid GSTIN: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]
const gstinFor = (state, i) => `${state}LDTST${pad(1000 + i, 4)}A1Z5`;

let phoneCounter = 0;
const synthPhone = () => `9999${pad(phoneCounter++, 6)}`; // 10 digits, obviously synthetic

function money(rupees) {
  return Math.round(rupees * 100);
}

/** Build the {invoice, items, loyalty} payloads for one history invoice. */
function buildInvoice({ shop, products, customer, dateISO, ownerId, paymentMode }) {
  const pick = [];
  const count = 1 + (Math.floor(Math.random() * 3)); // 1..3 lines
  for (let i = 0; i < count; i++) pick.push(products[Math.floor(Math.random() * products.length)]);

  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, total = 0;
  const items = pick.map((p) => {
    const qty = 1 + Math.floor(Math.random() * 3);
    const taxable = Math.round(qty * p.selling_price_paise);
    const rate = shop.gst_type === 'composition' ? 0 : p.gst_rate_percent;
    const gst = Math.round((taxable * rate) / 100);
    const cgst = Math.round(gst / 2);
    const sgst = gst - cgst;
    const lineTotal = taxable + cgst + sgst;
    subtotal += taxable; cgstTotal += cgst; sgstTotal += sgst; total += lineTotal;
    return {
      product_id: p.id,
      product_name: p.name,
      hsn_code: p.hsn_code,
      quantity: qty,
      unit: p.unit,
      unit_price_paise: p.selling_price_paise,
      discount_paise: 0,
      taxable_amount_paise: taxable,
      gst_rate_percent: rate,
      cgst_paise: cgst,
      sgst_paise: sgst,
      igst_paise: 0,
      total_paise: lineTotal,
    };
  });

  const invoice = {
    shop_id: shop.id,
    invoice_date: dateISO,
    invoice_type: 'regular',
    document_type: shop.gst_type === 'composition' ? 'bill_of_supply' : 'tax_invoice',
    customer_id: customer ? customer.id : null,
    customer_name: customer ? customer.name : 'Walk-in',
    customer_phone: customer ? customer.phone_number : null,
    billing_state_code: shop.state_code,
    is_inter_state: false,
    subtotal_paise: subtotal,
    cgst_total_paise: cgstTotal,
    sgst_total_paise: sgstTotal,
    igst_total_paise: 0,
    discount_paise: 0,
    round_off_paise: 0,
    total_paise: total,
    payment_mode: paymentMode,
    created_by: ownerId,
  };

  let loyalty = null;
  if (customer && paymentMode !== 'credit') {
    const points = Math.max(1, Math.floor(total / 10000)); // 1 pt / ₹100
    loyalty = { customer_id: customer.id, entry_type: 'earn', points, running_balance: points };
  }
  return { invoice, items, loyalty };
}

async function main() {
  const cfg = pgConfigFromEnv(env);
  const client = new pg.Client(cfg);
  await client.connect();

  const plan = { shops: N_SHOPS, users: N_SHOPS * (1 + N_CASHIERS), products: N_SHOPS * N_PRODUCTS,
    customers: N_SHOPS * N_CUSTOMERS, invoices: N_SHOPS * N_HISTORY };
  console.log(`\n🌱 seed run-id=${RUN_ID}  dry-run=${DRY}  target=${cfg.host}:${cfg.port}/${cfg.database}`);
  console.log(`   plan: ${plan.shops} shops · ${plan.users} users · ${plan.products} products · ` +
    `${plan.customers} customers · up to ${plan.invoices} history invoices\n`);

  const q = (text, params) => client.query(text, params);

  try {
    await q('BEGIN');
    // Belt-and-braces: guarantee no clash with an existing run-id.
    const clash = await q(`SELECT count(*)::int n FROM shops WHERE settings->>'perf_run_id' = $1`, [RUN_ID]);
    if (clash.rows[0].n > 0) throw new Error(`run-id "${RUN_ID}" already has ${clash.rows[0].n} shops — pick a new id or run cleanup first`);

    for (let s = 0; s < N_SHOPS; s++) {
      const v = VERTICALS[s % VERTICALS.length];
      const state = STATES[s % STATES.length];
      const shopId = randomUUID();
      const shop = {
        id: shopId, gst_type: v.gst_type, business_type: v.business_type, state_code: state,
        business_name: `${LOADTEST_PREFIX}Shop ${RUN_ID}-${s + 1}`,
      };
      await q(
        `INSERT INTO shops (id, business_name, legal_name, gstin, gst_type, business_type,
           address_line_1, city, state_code, pincode, phone, settings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [shopId, shop.business_name, shop.business_name, gstinFor(state, s), v.gst_type,
         v.business_type, '1 Test Rd', 'Testville', state, '400001', synthPhone(),
         JSON.stringify({ perf_run_id: RUN_ID, loadtest: true })]
      );

      // ── Users: 1 owner + N cashiers (auth.users + auth.identities + public.users) ──
      let ownerId = null;
      for (let u = 0; u < 1 + N_CASHIERS; u++) {
        const uid = randomUUID();
        const role = u === 0 ? 'owner' : 'cashier';
        if (u === 0) ownerId = uid;
        const email = `loadtest.${RUN_ID}.${s + 1}.${u}@perf.local`.toLowerCase();
        await q(
          `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
             email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
             confirmation_token, recovery_token, email_change_token_new, email_change)
           VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,
             crypt($3, gen_salt('bf')), now(),
             $4, $5, now(), now(), '', '', '', '')`,
          [uid, email, USER_PW,
           JSON.stringify({ provider: 'email', providers: ['email'], perf_run_id: RUN_ID }),
           JSON.stringify({ full_name: `${LOADTEST_PREFIX}${role} ${s + 1}` })]
        );
        await q(
          `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id,
             last_sign_in_at, created_at, updated_at)
           VALUES ($1,$1,$2,'email',$3, now(), now(), now())`,
          [uid, JSON.stringify({ sub: uid, email }), email]
        );
        await q(
          `INSERT INTO public.users (id, shop_id, full_name, phone, role, is_active)
           VALUES ($1,$2,$3,$4,$5,true)`,
          [uid, shopId, `${LOADTEST_PREFIX}${role} ${s + 1}`, synthPhone(), role]
        );
      }

      // ── Tag + campaign rule ──
      const tagId = randomUUID();
      await q(`INSERT INTO tags (id, shop_id, name) VALUES ($1,$2,$3)`,
        [tagId, shopId, `${LOADTEST_PREFIX}tag`]);
      await q(
        `INSERT INTO campaign_rules (id, shop_id, tag_id, trigger_days, message_template, is_active)
         VALUES ($1,$2,$3,$4,$5,true)`,
        [randomUUID(), shopId, tagId, 3,
         'Hi {{customer_name}}, time to revisit {{shop_name}}!']
      );

      // ── Products (+ inventory for tracked) ──
      const products = [];
      for (let p = 0; p < N_PRODUCTS; p++) {
        const pid = randomUUID();
        const tracked = p % 2 === 0;
        const rate = GST_SLABS[p % GST_SLABS.length];
        const price = money(100 + p * 25);
        products.push({ id: pid, name: `${LOADTEST_PREFIX}Product ${s + 1}-${p + 1}`,
          hsn_code: '40111000', unit: 'piece', selling_price_paise: price, gst_rate_percent: rate,
          is_stock_tracked: tracked });
        await q(
          `INSERT INTO products (id, shop_id, name, sku, hsn_code, gst_rate_percent,
             unit_price_paise, selling_price_paise, unit, category, vertical_attrs,
             is_stock_tracked, low_stock_threshold, purchase_price_paise, tag_id, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'piece','Test','{}'::jsonb,$9,5,$10,$11,true)`,
          [pid, shopId, products[p].name, `LT-${RUN_ID}-${s + 1}-${p + 1}`, '40111000', rate,
           money(80 + p * 20), price, tracked, money(80 + p * 20), p < 2 ? tagId : null]
        );
        if (tracked) {
          await q(
            `INSERT INTO inventory (id, shop_id, product_id, batch_number, quantity_in_stock,
               reorder_level, cost_price_paise)
             VALUES ($1,$2,$3,NULL,$4,10,$5)`,
            [randomUUID(), shopId, pid, 100000, money(80 + p * 20)]
          );
        }
      }

      // ── Customers ──
      const customers = [];
      for (let c = 0; c < N_CUSTOMERS; c++) {
        const cid = randomUUID();
        const cust = { id: cid, name: `${LOADTEST_PREFIX}Customer ${s + 1}-${c + 1}`, phone_number: synthPhone() };
        customers.push(cust);
        await q(
          `INSERT INTO customers (id, shop_id, phone_number, name, segment, total_spent_paise,
             visit_count, credit_balance_paise, dpdp_data_consent, dpdp_marketing_consent,
             dpdp_data_sharing_consent, consent_collected_at)
           VALUES ($1,$2,$3,$4,$5,0,0,0,true,true,false, now())`,
          [cid, shopId, cust.phone_number, cust.name, SEGMENTS[c % SEGMENTS.length]]
        );
      }

      // ── History invoices via the REAL save_invoice RPC ──
      // save_invoice enforces assert_authenticated_shop(auth.uid()); set the
      // standard Supabase JWT-claim GUC to the shop owner so the guard passes
      // when seeding via direct SQL. (Transaction-local; portable to real
      // Supabase, whose auth.uid() reads the same request.jwt.claim.sub.)
      await q(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [ownerId]);
      for (let h = 0; h < N_HISTORY; h++) {
        // ~40% attach a customer; rotate payment modes to exercise credit + loyalty paths.
        const withCust = h % 5 < 2 ? customers[h % customers.length] : null;
        const mode = h % 3 === 0 ? 'cash' : (withCust && h % 3 === 1 ? 'credit' : 'upi');
        // Back-date some to the campaign trigger window (3 days ago) for cron matches.
        const daysAgo = h % 2 === 0 ? 3 : (h % 7);
        const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
        const { invoice, items, loyalty } = buildInvoice({
          shop, products, customer: withCust, dateISO: d, ownerId, paymentMode: mode,
        });
        await q(`SELECT save_invoice($1::jsonb, $2::jsonb, $3::jsonb)`,
          [JSON.stringify(invoice), JSON.stringify(items), loyalty ? JSON.stringify(loyalty) : null]);
      }

      console.log(`  ✓ shop ${s + 1}/${N_SHOPS} (${v.business_type}, ${v.gst_type})`);
    }

    if (DRY) {
      await q('ROLLBACK');
      console.log(`\n🧪 DRY RUN complete — all inserts executed then ROLLED BACK. Nothing written.\n`);
    } else {
      await q('COMMIT');
      console.log(`\n✅ Seed committed. Tag: shops.settings->>'perf_run_id' = "${RUN_ID}".`);
      console.log(`   Reverse with: node perf/seed/cleanup.mjs --run-id ${RUN_ID}\n`);
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ Seed failed (rolled back): ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
