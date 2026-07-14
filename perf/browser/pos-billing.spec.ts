// =============================================================================
// perf/browser/pos-billing.spec.ts — POS billing UX smoke (M6)
//
// Logs in via the built-in dev login (email/password) and smokes the keyboard-
// driven billing screen's product search (the hot read path). Kept READ-ONLY —
// it does not commit an invoice — because the dev login maps to the pilot shop
// (Ganesh Tyres); we don't write pilot data. On the LOCAL disposable stack this
// is safe. Extend with a save-invoice step against a seeded synthetic user if
// you want a full write flow.
//
// Selectors are grounded in src/app/login/page.tsx and src/app/billing/page.tsx.
// =============================================================================

import { test, expect } from '@playwright/test';

test('POS: dev login reaches billing and product search returns results', async ({ page }) => {
  await page.goto('/login');

  // Built-in dev login button (src/app/login/page.tsx): "Dev: Login as Ganesh Tyres".
  await page.getByRole('button', { name: /Dev: Login as/i }).click();

  // Land on the app; navigate to the billing screen.
  await page.waitForURL(/\/(dashboard|billing)/, { timeout: 15_000 }).catch(() => {});
  await page.goto('/billing');

  // Product search box (placeholder: "Search product, SKU, or HSN... (F3)").
  const search = page.getByPlaceholder(/Search product, SKU, or HSN/i);
  await expect(search).toBeVisible({ timeout: 10_000 });
  await search.fill('a'); // broad query to surface catalogue rows

  // Expect at least one product result to render (read path works end-to-end).
  // Result rows render below the search input; assert the list is non-empty.
  await expect
    .poll(async () => page.locator('button', { hasText: /₹|HSN|\d/ }).count(), { timeout: 8_000 })
    .toBeGreaterThan(0);
});
