import { expect, test } from '@playwright/test';

test('public landing page renders without a framework error', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).not.toHaveText(/application error|internal server error/i);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page).toHaveTitle(/BharatGrowth/i);
});
