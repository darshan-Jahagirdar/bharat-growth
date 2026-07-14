// =============================================================================
// perf/dbload/soak.mjs — compressed soak with drift / connection sampling (M5)
//
// Runs steady moderate load in back-to-back segments and samples per-segment
// throughput, p95, and active DB connections, so latency creep or a connection
// leak shows up as an upward trend. A full 30–45 min soak belongs on the dev
// machine; this compressed version demonstrates stability and the tooling.
//
// LOCAL-ONLY. Usage:
//   node perf/dbload/soak.mjs --run-id m5 --workers 12 --segments 6 --segment-seconds 30
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';
import { runLoad } from './core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();
const args = parseArgs();
const RUN_ID = args['run-id'] || env.PERF_RUN_ID;
const WORKERS = Number(args.workers || 12);
const SEGMENTS = Number(args.segments || 6);
const SEG_S = Number(args['segment-seconds'] || 30);
const WRITE_RATIO = args['write-ratio'] !== undefined ? Number(args['write-ratio']) : 0.4;

const manifestPath = args.manifest && args.manifest !== true
  ? args.manifest : resolve(__dirname, '..', 'seed', `.manifest.${RUN_ID}.json`);
let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')); }
catch { console.error(`❌ Cannot read manifest ${manifestPath}. Seed first.`); process.exit(1); }

const cfg = pgConfigFromEnv(env);

async function activeConns(sampler) {
  const r = await sampler.query(
    `SELECT count(*)::int n FROM pg_stat_activity WHERE datname = $1`, [cfg.database]);
  return r.rows[0].n;
}

async function main() {
  const sampler = new pg.Client(cfg);
  await sampler.connect();

  console.log(`\n🕒 soak  workers=${WORKERS}  segments=${SEGMENTS}×${SEG_S}s  write-ratio=${WRITE_RATIO}  ` +
    `shops=${manifest.shops.length}  target=${cfg.host}:${cfg.port}/${cfg.database}\n`);
  console.log('  seg |  t(s) | W thr/s | W p50 | W p95 | R p95 | active_conns | err%');
  console.log('  ----+-------+---------+-------+-------+-------+--------------+------');

  const p95s = [];
  let t = 0;
  for (let i = 1; i <= SEGMENTS; i++) {
    const s = await runLoad({ cfg, manifest, mode: 'spread', workers: WORKERS, durationS: SEG_S, writeRatio: WRITE_RATIO });
    t += Math.round(s.elapsed);
    const conns = await activeConns(sampler);
    p95s.push(s.write.p95);
    console.log(
      `  ${String(i).padStart(3)} | ${String(t).padStart(5)} | ${s.write.thr.toFixed(0).padStart(7)} | ` +
      `${s.write.p50.toFixed(0).padStart(5)} | ${s.write.p95.toFixed(0).padStart(5)} | ` +
      `${s.read.p95.toFixed(1).padStart(5)} | ${String(conns).padStart(12)} | ${s.errRate.toFixed(1).padStart(4)}`);
    if (s.errRate > 10) { console.log('  ❌ error rate > 10% — stopping soak (safety gate)'); break; }
  }
  await sampler.end();

  const first = p95s[0], last = p95s[p95s.length - 1];
  const drift = first > 0 ? ((last - first) / first) * 100 : 0;
  console.log(`\n  p95 drift first→last: ${first.toFixed(0)}ms → ${last.toFixed(0)}ms (${drift >= 0 ? '+' : ''}${drift.toFixed(0)}%)`);
  console.log(`  ${Math.abs(drift) < 30 ? '✅ no significant latency drift' : '⚠️ latency drift > 30% — investigate'}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
