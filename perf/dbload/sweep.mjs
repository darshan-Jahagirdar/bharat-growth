// =============================================================================
// perf/dbload/sweep.mjs — DB-tier ramp sweep (M3)
//
// Runs the DB-tier load at increasing worker counts and prints a knee curve
// (throughput + p95 per level) for a mode. Use it to locate where per-shop
// write throughput flattens (concentrated) vs where it keeps scaling (spread).
//
// LOCAL-ONLY. Usage:
//   node perf/dbload/sweep.mjs --run-id demo --mode concentrated \
//     --levels 1,2,4,8,16,24,32,48,64 --step-seconds 6 --write-ratio 0.6
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
const MODE = args.mode === 'spread' ? 'spread' : 'concentrated';
const LEVELS = String(args.levels || '1,2,4,8,16,24,32,48,64').split(',').map(Number);
const STEP_S = Number(args['step-seconds'] || 6);
const WRITE_RATIO = args['write-ratio'] !== undefined ? Number(args['write-ratio']) : 0.6;

const manifestPath = args.manifest && args.manifest !== true
  ? args.manifest
  : resolve(__dirname, '..', 'seed', `.manifest.${RUN_ID}.json`);

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch {
  console.error(`❌ Cannot read manifest ${manifestPath}. Seed first.`);
  process.exit(1);
}

const cfg = pgConfigFromEnv(env);
console.log(`\n📈 DB-tier sweep  mode=${MODE}  write-ratio=${WRITE_RATIO}  step=${STEP_S}s  ` +
  `shops=${manifest.shops.length}  target=${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(`   levels: ${LEVELS.join(', ')}\n`);
console.log('  workers | W thr/s | W p50 | W p95 | W p99 | R thr/s | R p95 | err%');
console.log('  --------+---------+-------+-------+-------+---------+-------+------');

let peakThr = 0, peakAt = 0;
for (const w of LEVELS) {
  const s = await runLoad({ cfg, manifest, mode: MODE, workers: w, durationS: STEP_S, writeRatio: WRITE_RATIO });
  if (s.write.thr > peakThr) { peakThr = s.write.thr; peakAt = w; }
  console.log(
    `  ${String(w).padStart(7)} | ${s.write.thr.toFixed(0).padStart(7)} | ` +
    `${s.write.p50.toFixed(0).padStart(5)} | ${s.write.p95.toFixed(0).padStart(5)} | ` +
    `${s.write.p99.toFixed(0).padStart(5)} | ${s.read.thr.toFixed(0).padStart(7)} | ` +
    `${s.read.p95.toFixed(1).padStart(5)} | ${s.errRate.toFixed(1).padStart(4)}`);
  if (s.errRate > 10) { console.log('  ❌ error rate > 10% — stopping sweep (safety gate)'); break; }
}

console.log(`\n  peak write throughput ≈ ${peakThr.toFixed(0)}/s at ${peakAt} workers (${MODE})\n`);
