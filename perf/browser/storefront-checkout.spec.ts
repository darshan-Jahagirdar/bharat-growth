// =============================================================================
// perf/browser/storefront-checkout.spec.ts — public storefront checkout (M6)
//
// End-to-end UX smoke for the public storefront (no auth): open a shop, add a
// product, fill the checkout form with consent, place the order, and assert the
// checkout API returned 200. We assert on the /api/storefront/checkout response
// rather than following the WhatsApp redirect, so NO real WhatsApp is triggered
// (safety constraint).
//
// Selectors are grounded in src/components/storefront/ModernTheme.tsx. If the
// storefront theme differs for the seeded shop, adjust the getByPlaceholder /
// getByText locators below.
// =============================================================================

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(process.env.PERF_MANIFEST || 'perf/seed/.manifest.demo.json', 'utf-8'));
const shop = manifest.shops[0];

test('storefront checkout creates an order (API 200, no real WhatsApp)', async ({ page }) => {
  await page.goto(`/store/${shop.id}`);

  // Add the first product to the cart (each product card has an add button).
  // The add control is the last button in the product card; fall back to the
  // first enabled "add" affordance if the theme labels it.
  const addButtons = page.locator('button:below(:text("₹"))');
  await addButtons.first().click().catch(async () => {
    // Fallback: click the first product card action button.
    await page.locator('[class*="grid"] button').first().click();
  });

  // Open the checkout drawer.
  await page.getByText('Checkout', { exact: false }).first().click();
  await expect(page.getByText('Your Order')).toBeVisible();

  // Fill the checkout form (placeholders from ModernTheme).
  await page.getByPlaceholder('Your Name *').fill('LOADTEST Browser Buyer');
  await page.getByPlaceholder('Phone Number *').fill('9999001122');

  // Tick the DPDP consent checkbox (required, else Place Order stays disabled).
  await page.getByRole('checkbox').check();

  // Place the order and assert the checkout API succeeded. We do NOT follow the
  // WhatsApp link — asserting the API response is the safe signal.
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/storefront/checkout') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Place Order/i }).click(),
  ]);
  expect(resp.status(), await resp.text()).toBe(200);
  const body = await resp.json();
  expect(body.order_id).toBeTruthy();
  expect(body.invoice_number).toMatch(/^BG\//);
});
