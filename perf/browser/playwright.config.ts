// =============================================================================
// perf/browser/playwright.config.ts — narrow browser flows (M6)
//
// LOCAL-ONLY. Targets the local Next dev server against the local Supabase stack.
// These are a few end-to-end UX smoke flows under light concurrency — NOT the
// load engine (that's k6 / perf/dbload). Chromium is pre-installed.
//
// Run (from repo root):
//   supabase start && npm run dev            # local stack + app
//   node perf/seed/seed.mjs --run-id demo --shops 2
//   PERF_APP_URL=http://127.0.0.1:3000 \
//   PERF_MANIFEST=perf/seed/.manifest.demo.json \
//   npx playwright test -c perf/browser/playwright.config.ts
// =============================================================================

import { defineConfig, devices } from '@playwright/test';

const APP_URL = process.env.PERF_APP_URL || 'http://127.0.0.1:3000';

// Safety: refuse any non-local target.
const host = (APP_URL.match(/^https?:\/\/([^:/]+)/) || [])[1] || '';
if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(host)) {
  throw new Error(`SAFETY ABORT: PERF_APP_URL=${APP_URL} is not local.`);
}

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: true,
  workers: 3, // light concurrency for the UX flows
  reporter: [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
