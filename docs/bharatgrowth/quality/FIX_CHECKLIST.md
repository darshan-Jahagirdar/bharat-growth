# Production-Quality Checklist

This reconciles `docs/FIX_CHECKLIST.md` with the current checkpoint. Checked
items require evidence; code presence alone is not completion.

Last reconciled: 2026-07-15 at integration application checkpoint `907dfe3`.
Production remains unchanged at `8c38909`.

## Release blockers

- [x] Neutralize the committed development auth migration and remove hardcoded
  development login paths. Production credential verification remains external.
- [x] Update the Anthropic model identifier to the officially documented
  `claude-sonnet-5`. A real staging bill scan remains required.
- [ ] Rotate `CRON_SECRET` in Vercel; do not expose its value.
- [ ] Register and test the Meta webhook environment/configuration.
- [ ] Obtain approval for production WhatsApp templates with opt-out wording.
- [ ] Add production error monitoring and verify a test event.
- [ ] Add rate limiting to public checkout and outbound messaging surfaces.
- [x] Apply and verify the additive public-data RPC/RLS hardening migrations on
  isolated staging; legacy anonymous compatibility policies intentionally remain.
- [ ] Include/review migration 049 contract cleanup after all decomposition
  waves and verify it on staging.

## Engineering gates

- [x] CI requires typecheck, lint, tests, build, and public smoke; Wave 5 exact
  checks are green.
- [ ] Characterization tests cover every decomposition domain. Billing, Orders,
  Products, Dashboard, and Purchases are covered; Storefront characterization is
  the first Wave 6 gate and data-access compatibility is the Wave 7 gate.
- [x] GSTIN mod-36 checksum validation is implemented and unit-tested.
- [ ] Full manual regression checklist passes before paid/public launch.
- [ ] Production logs and monitoring show no new blocking error after rollout.

## Decomposition gates

- [x] Waves 1–5 merged only into integration with automated, staging, visual,
  cleanup, repository-doc, Google handoff, and Slack evidence.
- [ ] Wave 6 Storefront completes the same gates without changing theme, cart,
  checkout, stock, consent, payload, copy, or visual behavior.
- [ ] Wave 7 data access completes behind compatibility exports without query or
  RPC behavior change.
- [ ] Full integration application and migration candidate pass the complete
  pre-launch regression matrix.

## Product backlog, not decomposition

- Server-authoritative POS totals.
- Loyalty redemption.
- Payments/subscriptions and WhatsApp credit packs.
- Offline billing, bilingual UI, and e-invoicing roadmap items.
- DPDP customer erasure/anonymization flow.

See [`../product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](../product/FEATURE_AND_BEHAVIOR_INVENTORY.md)
for current-versus-planned truth and [`../COLLABORATION_WORKFLOW.md`](../COLLABORATION_WORKFLOW.md)
for milestone evidence flow.

The final quality scorecard must distinguish implemented, automatically proven,
manually proven, externally configured, and still-open items.
