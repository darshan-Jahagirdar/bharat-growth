// =============================================================================
// perf/seed/cleanup.mjs — reversible teardown of one seed run (M1)
//
// Deletes STRICTLY the data tagged with a given --run-id and nothing else:
//   1. find shops WHERE settings->>'perf_run_id' = <run-id>
//   2. collect their user ids (for auth.users removal)
//   3. DELETE those shops → every child row CASCADEs away (all shop_id FKs are
//      ON DELETE CASCADE), leaving pilot/other data untouched
//   4. DELETE the matching auth.users / auth.identities rows
//
// LOCAL-ONLY (aborts on any non-127.0.0.1 host). --dry-run reports the counts
// it WOULD delete without deleting.
//
// Usage: node perf/seed/cleanup.mjs --run-id 20260714-01 [--dry-run]
// =============================================================================

import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';

const env = loadEnv();
const args = parseArgs();
const RUN_ID = args['run-id'] || env.PERF_RUN_ID;
const DRY = Boolean(args['dry-run']);

if (!RUN_ID || RUN_ID === true) {
  console.error('❌ --run-id <id> is required.');
  process.exit(1);
}

async function main() {
  const cfg = pgConfigFromEnv(env);
  const client = new pg.Client(cfg);
  await client.connect();
  const q = (t, p) => client.query(t, p);

  try {
    const shopRes = await q(`SELECT id FROM shops WHERE settings->>'perf_run_id' = $1`, [RUN_ID]);
    const shopIds = shopRes.rows.map((r) => r.id);
    if (shopIds.length === 0) {
      console.log(`\nℹ️  No shops tagged run-id "${RUN_ID}". Nothing to clean.\n`);
      return;
    }
    const userRes = await q(`SELECT id FROM public.users WHERE shop_id = ANY($1::uuid[])`, [shopIds]);
    const userIds = userRes.rows.map((r) => r.id);

    // Report what CASCADE will remove, for transparency.
    const counts = {};
    for (const tbl of ['products', 'customers', 'invoices', 'invoice_items', 'inventory',
      'inventory_movements', 'credit_ledger', 'loyalty_ledger', 'message_logs', 'consent_logs',
      'tags', 'campaign_rules']) {
      const r = await q(`SELECT count(*)::int n FROM ${tbl} WHERE shop_id = ANY($1::uuid[])`, [shopIds]);
      counts[tbl] = r.rows[0].n;
    }
    console.log(`\n🧹 cleanup run-id=${RUN_ID}  dry-run=${DRY}  target=${cfg.host}:${cfg.port}/${cfg.database}`);
    console.log(`   shops=${shopIds.length}, users=${userIds.length}, ` +
      Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', '));

    if (DRY) {
      console.log(`\n🧪 DRY RUN — nothing deleted.\n`);
      return;
    }

    await q('BEGIN');
    // Deleting the shops cascades every shop_id child row.
    const delShops = await q(`DELETE FROM shops WHERE id = ANY($1::uuid[])`, [shopIds]);
    // Remove the auth users (public.users already gone via cascade).
    if (userIds.length) {
      await q(`DELETE FROM auth.identities WHERE user_id = ANY($1::uuid[])`, [userIds]);
      await q(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [userIds]);
    }
    // Belt-and-braces: any stray auth.users tagged with this run-id.
    await q(`DELETE FROM auth.users WHERE raw_app_meta_data->>'perf_run_id' = $1`, [RUN_ID]);
    await q('COMMIT');

    console.log(`\n✅ Removed ${delShops.rowCount} shops + ${userIds.length} auth users (cascade cleared children).\n`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n❌ Cleanup failed (rolled back): ${e.message}\n`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
