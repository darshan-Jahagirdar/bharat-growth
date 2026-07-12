# Production-Quality Checklist

This reconciles `docs/FIX_CHECKLIST.md` with the current checkpoint. Checked
items require evidence; code presence alone is not completion.

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
- [ ] Apply and verify the public-data RLS hardening migrations.

## Engineering gates

- [ ] CI requires typecheck, lint, tests, and build.
- [ ] Characterization tests cover critical billing, tax, stock, ledger, loyalty,
  campaign, receipt, and storefront behavior.
- [x] GSTIN mod-36 checksum validation is implemented and unit-tested.
- [ ] Full manual regression checklist passes before paid/public launch.
- [ ] Production logs and monitoring show no new blocking error after rollout.

## Product backlog, not decomposition

- Server-authoritative POS totals.
- Loyalty redemption.
- Payments/subscriptions and WhatsApp credit packs.
- Offline billing, bilingual UI, and e-invoicing roadmap items.
- DPDP customer erasure/anonymization flow.

The final quality scorecard must distinguish implemented, automatically proven,
manually proven, externally configured, and still-open items.
