// =============================================================================
// perf/lib/env.mjs — shared config + LOCAL-ONLY guard for Node perf scripts
// Dependency-free except for the standard library. Loads perf/.env.perf (if
// present) UNDER process.env, exposes a Postgres config, and refuses to touch
// any non-local host.
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.perf');
  const fileVars = {};
  try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) fileVars[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* no .env.perf — rely on process.env */
  }
  return { ...fileVars, ...process.env };
}

const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isLoopbackIp(ip) {
  if (net.isIPv4(ip)) return ip.startsWith('127.');
  if (net.isIPv6(ip)) return ip === '::1' || ip === '::ffff:127.0.0.1';
  return false;
}

/**
 * Hard-abort unless the DB host is local. This is the primary safety control:
 * the perf scripts literally cannot connect to hosted data.
 */
export function assertLocalHostOrExit(host) {
  const h = (host || '').trim();
  if (LOCAL.has(h) || isLoopbackIp(h)) return h;
  console.error(
    `\n❌ SAFETY ABORT — DB host "${h}" is not local.\n` +
      `   These perf scripts only run against a local supabase/Postgres (127.0.0.1).\n`
  );
  process.exit(1);
}

export function pgConfigFromEnv(env = loadEnv()) {
  const host = env.PERF_DB_HOST || '127.0.0.1';
  assertLocalHostOrExit(host);
  return {
    host,
    port: Number(env.PERF_DB_PORT || 54322),
    database: env.PERF_DB_NAME || 'postgres',
    user: env.PERF_DB_USER || 'postgres',
    password: env.PERF_DB_PASSWORD || 'postgres',
  };
}

/** Minimal --flag / --flag value argv parser. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

export const LOADTEST_PREFIX = 'LOADTEST-';
