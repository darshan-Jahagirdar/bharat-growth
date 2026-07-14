// =============================================================================
// BharatGrowth perf harness — LOCAL-ONLY env-guard
//
// Refuses to proceed unless every configured target resolves to the local
// machine (127.0.0.1 / ::1 / localhost). ANY hosted/staging/prod-looking host
// hard-aborts with a non-zero exit code. This is the primary safety control:
// the load harness literally cannot reach hosted data if this guard passes.
//
// Safe & read-only: it only inspects env vars and does DNS lookups. It writes
// nothing and connects to nothing.
//
// Usage:
//   node perf/guard/check-env.mjs
// Env sources (first found wins per var), loaded from process.env or perf/.env.perf:
//   PERF_TARGET_URL             e.g. http://127.0.0.1:54321
//   NEXT_PUBLIC_SUPABASE_URL    e.g. http://127.0.0.1:54321
//   PERF_DB_HOST                e.g. 127.0.0.1  (optional; defaults 127.0.0.1)
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function loadEnvFile() {
  // Optional perf/.env.perf — merged UNDER process.env (process.env wins).
  const envPath = resolve(__dirname, '..', '.env.perf');
  const out = {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    // no .env.perf — that's fine, rely on process.env
  }
  return { ...out, ...process.env };
}

function isLoopbackIp(ip) {
  if (net.isIPv4(ip)) return ip === '127.0.0.1' || ip.startsWith('127.');
  if (net.isIPv6(ip)) return ip === '::1' || ip === '::ffff:127.0.0.1';
  return false;
}

async function assertLocalHost(label, hostname) {
  const host = (hostname || '').trim();
  if (!host) throw new Error(`${label}: empty host`);

  if (!LOCAL_HOSTNAMES.has(host)) {
    // Not a literal loopback token — resolve it and require every A/AAAA to be loopback.
    let records;
    try {
      records = await lookup(host, { all: true });
    } catch (e) {
      throw new Error(`${label}: cannot resolve host "${host}" (${e.code || e.message})`);
    }
    const nonLoopback = records.filter((r) => !isLoopbackIp(r.address));
    if (nonLoopback.length > 0) {
      throw new Error(
        `${label}: host "${host}" resolves to non-loopback ${nonLoopback
          .map((r) => r.address)
          .join(', ')} — refusing to run against a hosted target`
      );
    }
  }
  return host;
}

function hostOf(urlStr, label) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error(`${label}: not a valid URL: "${urlStr}"`);
  }
  return u.hostname;
}

async function main() {
  const env = loadEnvFile();

  const targetUrl = env.PERF_TARGET_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!targetUrl) {
    throw new Error(
      'No target configured. Set PERF_TARGET_URL (or NEXT_PUBLIC_SUPABASE_URL) to your local ' +
        'supabase URL, e.g. http://127.0.0.1:54321'
    );
  }

  const checks = [];
  checks.push(['PERF_TARGET_URL', hostOf(targetUrl, 'PERF_TARGET_URL')]);
  if (env.PERF_DB_HOST) checks.push(['PERF_DB_HOST', env.PERF_DB_HOST]);
  else checks.push(['PERF_DB_HOST(default)', '127.0.0.1']);

  for (const [label, host] of checks) {
    const ok = await assertLocalHost(label, host);
    console.log(`  ✓ ${label} → ${ok} (local)`);
  }

  console.log('\n✅ env-guard OK — all targets are LOCAL (127.0.0.1/localhost). Safe to proceed.\n');
}

main().catch((err) => {
  console.error(`\n❌ env-guard ABORT — ${err.message}\n`);
  console.error('This harness only runs against a local `supabase start` stack. ' +
    'Point PERF_TARGET_URL at http://127.0.0.1:54321 and retry.\n');
  process.exit(1);
});
