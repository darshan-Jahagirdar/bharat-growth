# perf/browser/ — narrow Playwright flows (M6)

A few end-to-end **UX smoke** flows (NOT the load engine — that's k6 / `perf/dbload`). They run on a
**dev machine** with the local Supabase stack + Next dev server up; Chromium is pre-installed.

## Flows
- `storefront-checkout.spec.ts` — public storefront: add product → checkout form + DPDP consent →
  place order; asserts the `/api/storefront/checkout` response is 200 (does **not** follow the
  WhatsApp redirect, so no real message is sent).
- `pos-billing.spec.ts` — dev login → billing screen → product search returns results (read path).
  Read-only (doesn't commit a pilot invoice).

## Run
```bash
supabase start && npm run dev
node perf/seed/seed.mjs --run-id demo --shops 2      # writes the manifest
PERF_APP_URL=http://127.0.0.1:3000 \
PERF_MANIFEST=perf/seed/.manifest.demo.json \
npx playwright test -c perf/browser/playwright.config.ts
```

## Selector caveat
The app has no `data-testid`s, so these use placeholder/role/text locators grounded in the current
components (`ModernTheme.tsx`, `login/page.tsx`, `billing/page.tsx`). They couldn't be executed in
the build environment (no browser/dev-server there); on first run, adjust a locator if a theme or
label differs. Adding `data-testid`s to the checkout form, product cards, and billing search/save
controls would make these flows robust — a small, worthwhile follow-up.
