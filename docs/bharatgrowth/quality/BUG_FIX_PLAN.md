# Bug-Fix Status

Canonical status derived from the detailed audit in `docs/BUG_FIX_PLAN.md` and
the code checkpoint `4b7424a`.

## Implemented locally; not production-proven

- WhatsApp failure classification and campaign claim release.
- Receipt/storefront public-data access through constrained RPCs.
- Atomic credit repayment.
- Sales-order fractional quantity and composition-GST fixes.
- Loyalty selection race, IST invoice date, demo-save, search escaping, UPI
  modal/keyboard, and repayment-modal fixes.
- Authenticated and atomic AI scan quota handling with file validation.
- Loyalty balance locking and stale-search protection.

These remain incomplete until migrations 042-046 are applied to staging and the
transactional/RLS smoke cases pass.

## Explicitly deferred product decisions

- Inter-state sales-order conversion needs buyer-state data and UX.
- Discount engine behavior and UI.
- Sales-order conversion loyalty/campaign attribution.
- Server-authoritative POS totals and GST recomputation.

## Evidence required to close the baseline

- Clean lint, typecheck, unit tests, and production build.
- Staging migration dry run and application with no drift.
- Anonymous access denial plus working public receipt/storefront flows.
- Concurrent sale/repayment, loyalty, and AI-quota checks.
- Fractional sales-order conversion and composition bill-of-supply checks.
- Vercel preview smoke with no blocking console/server errors.

## Local and staging evidence — 2026-07-12

- 33 Vitest characterization/security tests pass across 7 files.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- The production build generated all 25 application routes.
- Playwright and direct browser content/overlay checks pass in installed Chrome.
- Fresh staging migrations 001-048 and the inactive-campaign synthetic seed apply
  successfully; linked-schema lint has no errors.
