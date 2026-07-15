# Bug-Fix and Hardening Status

Last reconciled: 2026-07-15. The detailed July audit remains at
[`../../BUG_FIX_PLAN.md`](../../BUG_FIX_PLAN.md); this file is the canonical
current status.

## Implemented and staging-proven

- WhatsApp provider-failure classification and campaign claim release.
- Constrained public receipt and owner-phone RPCs, with additive compatibility
  preserved for the current Storefront loader. Legacy anonymous policies are not
  closed until migration 049 and consumer verification.
- Atomic credit repayment, loyalty balance locking, and AI scan quota.
- Sales-order fractional quantity and composition-GST fixes.
- IST invoice/date behavior, stale-search protection, GSTIN checksum, UPI
  amount/modal/keyboard behavior, demo-save, and repayment-modal fixes.
- Neutralized dev-auth migration/hardcoded login path.
- Bearer-header cron authorization and migration safety guards.
- Continuous staging migrations 001–048, synthetic seed, tenant/RLS smoke, CI,
  and isolated Vercel preview flow.

Evidence at the Wave 5 integration checkpoint:

- linked staging `qokaaggeqahayxsybgds`, local/remote migrations 001–048 match;
- 94 tests across 19 files, strict typecheck, zero-warning lint, and 25-route
  optimized build pass;
- GitHub `quality` and `public-smoke` pass;
- integration deployment `dpl_5HprXDZjfavK1vGGYbtzZnGweWaB` is READY for exact
  application checkpoint `907dfe3` and has no queried error-level runtime logs.

These facts do not mean production is updated. Production remains `8c38909`.

## External or release blockers still open

- Rotate `CRON_SECRET` without exposing it.
- Configure and test production Meta webhook/provider settings.
- Obtain approved production WhatsApp marketing templates and opt-out wording.
- Add production error monitoring and verify a test event.
- Add rate limiting to public checkout and outbound messaging.
- Perform an approved real staging AI bill scan.
- Write/review/apply migration 049 on staging after all decomposition waves.
- Complete full manual sale-readiness regression and the explicit production
  identity/rollout gate.

## Explicit product backlog, not decomposition bugs

- Auth/provider redesign and payment gateway/subscriptions.
- Inter-state Sales Order conversion needing buyer-state UX.
- Discount engine behavior and UI.
- Sales-order conversion loyalty/campaign attribution.
- Server-authoritative POS totals/GST recomputation.
- Loyalty redemption.
- Offline billing, bilingual UI, e-invoicing, and full DPDP
  erasure/anonymization.

## Decomposition status

Waves 1 Billing, 2 Orders, 3 Products, 4 Dashboard/progress, and 5 Purchases are
merged only into integration. Wave 6 Storefront is next; Wave 7 data access is
last. Structural work must preserve the feature/behavior inventory and cannot
absorb any open blocker or backlog item.
