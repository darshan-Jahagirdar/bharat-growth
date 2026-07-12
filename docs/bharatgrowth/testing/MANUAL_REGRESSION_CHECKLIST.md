# Manual Regression Checklist

Use dedicated staging users and synthetic data. Record tester, date, commit,
environment, and evidence for every release candidate.

## Authentication and tenancy

- [ ] Phone OTP and email magic link succeed with correct redirects.
- [ ] Unauthenticated users cannot open protected routes.
- [ ] A user cannot read or mutate another shop's data through UI, API, or RPC.
- [ ] Known development credentials fail against production.

## Billing, tax, stock, and credit

- [ ] Cash, UPI, card, and credit sales preserve totals and receipt behavior.
- [ ] POS keyboard navigation, barcode entry, modal blocking, and print work.
- [ ] GST 0/5/12/18/28, intra/inter-state, composition, rounding, and IST/FY date
  behavior match the baseline.
- [ ] POS negative stock remains allowed; storefront strict stock remains enforced.
- [ ] Khata sale, valid repayment, rejected overpayment, and concurrent repayment
  reconcile with the ledger.
- [ ] Loyalty points and running balance remain correct through customer changes.

## Products, purchases, and orders

- [ ] Product create/edit/search, stock adjustment, tags, and bulk flows work.
- [ ] Purchase editable grid, keyboard actions, AI scan mapping, draft PO, and save
  work without focus or total changes.
- [ ] Sales/purchase order filters, status actions, WhatsApp links, fractional SO
  conversion, and composition conversion work.

## Public surfaces and campaigns

- [ ] Storefront catalog, themes, cart, checkout, idempotency, and contact CTA work.
- [ ] Public receipt loads while direct sensitive table/column reads are denied.
- [ ] Progress/dashboard metrics match the pre-decomposition fixtures.
- [ ] Campaign match, consent, cooldown, dedupe, cap, claim/send, failure release,
  ROI, and STOP webhook behavior work.

## Release evidence

- [ ] Lint, typecheck, unit tests, build, and E2E checks pass.
- [ ] No unexpected browser console or Vercel runtime errors.
- [ ] Supabase migration ledger and project ref are correct.
- [ ] Rollback commit/deployment and recovery migration are identified.
- [ ] Remaining known limitations are listed in the release and Slack update.
