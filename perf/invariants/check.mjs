// =============================================================================
// perf/invariants/check.mjs — data-integrity checker (M1)
//
// Runs a battery of SQL invariants against the LOCAL database and prints a
// PASS/FAIL verdict. This — not latency — is the real pass/fail signal for the
// concurrency and multi-tenant scenarios. Exit code 0 = all pass, 1 = any fail.
//
// Optional --run-id scopes checks to one seed run's shops; otherwise checks all.
//
// Usage: node perf/invariants/check.mjs [--run-id 20260714-01]
// =============================================================================

import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';

const env = loadEnv();
const args = parseArgs();
const RUN_ID = args['run-id'] && args['run-id'] !== true ? args['run-id'] : null;

// Each invariant is a query returning a single column `n` = number of violations.
// {S} is replaced with a shop-scope predicate bound to $1 (uuid[]) when scoped.
const CHECKS = [
  ['duplicate_invoice_numbers',
    `SELECT count(*)::int n FROM (
       SELECT 1 FROM invoices WHERE {S} GROUP BY shop_id, financial_year, invoice_number HAVING count(*) > 1
     ) x`],
  ['duplicate_invoice_sequence',
    `SELECT count(*)::int n FROM (
       SELECT 1 FROM invoices WHERE {S} GROUP BY shop_id, financial_year, invoice_sequence HAVING count(*) > 1
     ) x`],
  ['invoice_sequence_gaps',
    `SELECT COALESCE(sum(max_seq - cnt),0)::int n FROM (
       SELECT max(invoice_sequence) max_seq, count(DISTINCT invoice_sequence) cnt
       FROM invoices WHERE {S} GROUP BY shop_id, financial_year
     ) x`],
  ['invoice_total_vs_items',
    `SELECT count(*)::int n FROM invoices i WHERE {S}
       AND i.total_paise <> COALESCE((SELECT sum(total_paise) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0)`],
  ['invoice_header_arithmetic',
    `SELECT count(*)::int n FROM invoices i WHERE {S}
       AND i.total_paise <> (i.subtotal_paise + i.cgst_total_paise + i.sgst_total_paise
                             + i.igst_total_paise - i.discount_paise + i.round_off_paise)`],
  ['invoice_item_line_arithmetic',
    `SELECT count(*)::int n FROM invoice_items ii WHERE {S}
       AND ii.total_paise <> (ii.taxable_amount_paise + ii.cgst_paise + ii.sgst_paise
                              + ii.igst_paise - ii.discount_paise)`],
  ['tenant_isolation_invoice_items',
    `SELECT count(*)::int n FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       WHERE {Si} AND ii.shop_id <> i.shop_id`],
  ['tenant_isolation_credit_ledger',
    `SELECT count(*)::int n FROM credit_ledger cl JOIN invoices i ON i.id = cl.invoice_id
       WHERE {Si} AND cl.shop_id <> i.shop_id`],
  ['credit_balance_reconciliation',
    `SELECT count(*)::int n FROM customers c WHERE {S}
       AND c.credit_balance_paise <> COALESCE((
         SELECT sum(CASE transaction_type WHEN 'credit_given' THEN amount_paise
                                          WHEN 'payment_received' THEN -amount_paise ELSE 0 END)
         FROM credit_ledger cl WHERE cl.customer_id = c.id), 0)`],
  ['total_spent_reconciliation',
    `SELECT count(*)::int n FROM customers c WHERE {S}
       AND c.total_spent_paise <> COALESCE((
         SELECT sum(i.total_paise) FROM invoices i
         WHERE i.customer_id = c.id
           AND EXISTS (SELECT 1 FROM loyalty_ledger ll WHERE ll.invoice_id = i.id AND ll.customer_id = c.id)), 0)`],
  ['visit_count_reconciliation',
    `SELECT count(*)::int n FROM customers c WHERE {S}
       AND c.visit_count <> COALESCE((
         SELECT count(DISTINCT i.id) FROM invoices i
         WHERE i.customer_id = c.id
           AND EXISTS (SELECT 1 FROM loyalty_ledger ll WHERE ll.invoice_id = i.id AND ll.customer_id = c.id)), 0)`],
  ['inventory_movement_running_balance',
    `SELECT count(*)::int n FROM (
       SELECT quantity_after, quantity_change,
              lag(quantity_after) OVER (PARTITION BY inventory_id ORDER BY ctid) prev
       FROM inventory_movements m WHERE {S}
     ) x WHERE prev IS NOT NULL AND quantity_after <> prev + quantity_change`],
  ['inventory_final_matches_ledger',
    `SELECT count(*)::int n FROM inventory inv WHERE {S}
       AND EXISTS (SELECT 1 FROM inventory_movements m WHERE m.inventory_id = inv.id)
       AND inv.quantity_in_stock <> (
         SELECT quantity_after FROM inventory_movements m WHERE m.inventory_id = inv.id ORDER BY ctid DESC LIMIT 1)`],
  ['negative_credit_balances',
    `SELECT count(*)::int n FROM customers c WHERE {S} AND c.credit_balance_paise < 0`],
];

function scoped(sql, scopedRun) {
  // {S}  → plain shop_id predicate; {Si} → predicate on alias i.shop_id (joins)
  if (!scopedRun) return sql.replaceAll('{S}', 'TRUE').replaceAll('{Si}', 'TRUE');
  return sql.replaceAll('{S}', 'shop_id = ANY($1::uuid[])').replaceAll('{Si}', 'i.shop_id = ANY($1::uuid[])');
}

async function main() {
  const cfg = pgConfigFromEnv(env);
  const client = new pg.Client(cfg);
  await client.connect();

  try {
    let shopIds = null;
    if (RUN_ID) {
      const r = await client.query(`SELECT id FROM shops WHERE settings->>'perf_run_id' = $1`, [RUN_ID]);
      shopIds = r.rows.map((x) => x.id);
      console.log(`\n🔎 invariant check  scope=run-id:${RUN_ID} (${shopIds.length} shops)  target=${cfg.host}:${cfg.port}/${cfg.database}\n`);
      if (shopIds.length === 0) console.log('   (no shops for that run-id — checks run over an empty scope)\n');
    } else {
      console.log(`\n🔎 invariant check  scope=ALL DATA  target=${cfg.host}:${cfg.port}/${cfg.database}\n`);
    }

    let failed = 0;
    for (const [name, sql] of CHECKS) {
      const text = scoped(sql, Boolean(RUN_ID));
      const params = RUN_ID ? [shopIds] : [];
      let n;
      try {
        ({ rows: [{ n }] } = await client.query(text, params));
      } catch (e) {
        console.log(`  ⚠️  ERROR  ${name}: ${e.message}`);
        failed++;
        continue;
      }
      const pass = n === 0;
      if (!pass) failed++;
      console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}  ${name}${pass ? '' : `  (violations: ${n})`}`);
    }

    console.log(`\n${failed === 0 ? '✅ ALL INVARIANTS PASSED' : `❌ ${failed} INVARIANT(S) FAILED`}\n`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main();
