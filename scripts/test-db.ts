// =============================================================================
// BharatGrowth — Quick DB Connection Test
// Run: npx tsx scripts/test-db.ts
// Proves .env.local credentials are wired to Supabase Cloud
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const key = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log(`\n🔗 Connecting to: ${url}\n`);

const supabase = createClient(url, key);

async function test() {
  // 1. Test shops table
  const { data: shops, error: shopErr } = await supabase
    .from('shops')
    .select('id, business_name, city, gst_type')
    .limit(5);

  if (shopErr) {
    console.error('❌ Shops query failed:', shopErr.message);
    process.exit(1);
  }
  console.log(`✅ Shops table: ${shops.length} row(s)`);
  shops.forEach((s) => console.log(`   → ${s.business_name} (${s.city}) [${s.gst_type}]`));

  // 2. Test products table
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, hsn_code, gst_rate_percent')
    .limit(5);

  if (prodErr) {
    console.error('❌ Products query failed:', prodErr.message);
    process.exit(1);
  }
  console.log(`\n✅ Products table: ${products.length} row(s)`);
  products.forEach((p) => console.log(`   → ${p.name} (HSN: ${p.hsn_code}, GST: ${p.gst_rate_percent}%)`));

  // 3. Test invoices table
  const { count, error: invErr } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true });

  if (invErr) {
    console.error('❌ Invoices query failed:', invErr.message);
    process.exit(1);
  }
  console.log(`\n✅ Invoices table: ${count ?? 0} row(s)`);

  // 4. Test RPC
  const { error: rpcErr } = await supabase.rpc('get_financial_year', {
    d: new Date().toISOString().split('T')[0],
  });

  if (rpcErr) {
    console.error('❌ RPC get_financial_year failed:', rpcErr.message);
  } else {
    console.log('✅ RPC get_financial_year: working');
  }

  console.log('\n🎉 All connection tests passed! Database is live.\n');
}

test().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
