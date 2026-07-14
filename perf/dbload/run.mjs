// =============================================================================
// perf/dbload/run.mjs — DB-tier load harness (single run)
//
// Drives the REAL save_invoice RPC (and representative reads) directly against
// the local Postgres under controlled concurrency, and reports latency
// percentiles + throughput. Measures the central bottleneck — the per-shop
// advisory lock in save_invoice — WITHOUT the HTTP stack (GoTrue/PostgREST/Next).
//
// Mirrors production shape: each invoice runs in ONE transaction with the JWT-sub
// claim set transaction-local (how PostgREST invokes the SECURITY DEFINER RPC).
//
//   --mode spread | concentrated   (concentrated = one shop = advisory lock always collides)
//
// LOCAL-ONLY. Usage:
//   node perf/dbload/run.mjs --run-id demo --mode spread --workers 16 --duration 10
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, pgConfigFromEnv, parseArgs } from '../lib/env.mjs';
import { runLoad } from './core.mjs';

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
if (!manifest.shops?.length) { console.error('❌ Manifest has no shops.'); process.exit(1); }

const cfg = pgConfigFromEnv(env);
console.log(`\n⚙️  DB-tier load  mode=${MODE}  workers=${WORKERS}  duration=${DURATION_S}s  ` +
  `write-ratio=${WRITE_RATIO}  target=${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(`   shops=${manifest.shops.length}\n`);

const s = await runLoad({ cfg, manifest, mode: MODE, workers: WORKERS, durationS: DURATION_S, writeRatio: WRITE_RATIO });

const line = (label, r, ops) =>
  `  ${label.padEnd(18)} ops=${String(ops).padStart(6)}  thr=${r.thr.toFixed(1).padStart(7)}/s  ` +
  `p50=${r.p50.toFixed(1)}ms  p95=${r.p95.toFixed(1)}ms  p99=${r.p99.toFixed(1)}ms  max=${r.max.toFixed(1)}ms`;

console.log('  ── results ─────────────────────────────────────────────────────────');
console.log(line('save_invoice (W)', s.write, s.opsW));
console.log(line('product read (R)', s.read, s.opsR));
console.log(`  ${''.padEnd(18)} total=${s.opsW + s.opsR}  errors=${s.errors} (${s.errRate.toFixed(2)}%)  wall=${s.elapsed.toFixed(1)}s`);
console.log(`  ${s.errRate > 10 ? '❌ ERROR RATE > 10% — safety threshold breached' : '✅ error rate within 10% gate'}\n`);
