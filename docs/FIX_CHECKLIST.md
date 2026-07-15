# BharatGrowth — Fix Checklist

> Historical review checklist. Unchecked boxes below do not imply the current
> state; several staging/CI items have since passed. Canonical current release
> gates live in
> [`docs/bharatgrowth/quality/FIX_CHECKLIST.md`](bharatgrowth/quality/FIX_CHECKLIST.md).

Prioritized action list from the July 7, 2026 code review. Ordered by risk: P0 items are
security/compliance/broken-feature blockers, P3 items gate the paid/public launch.
Check items off as they land; each item lists how to verify it's actually fixed.

---

## P0 — Do immediately (minutes to hours)

### 1. Remove the dev auth backdoor from production
- [ ] Check production `auth.users` for `dev@bharatgrowth.in` (Supabase Dashboard → Authentication → Users)
- [ ] If it exists: delete the user (or rotate to a random password stored only in a password manager)
- [ ] Verify the shop-1 `public.users` row tied to `def00000-...-0001` is removed or re-owned
- [ ] Delete or neutralize `supabase/migrations/011_dev_auth_user.sql` so it can never be applied to a fresh prod DB (replace body with a no-op comment; do not renumber migrations)
- [ ] Remove the hardcoded password from `src/components/DevLogin.tsx` — gate dev login behind an env var (`DEV_LOGIN_EMAIL/PASSWORD` in `.env.local`) instead of literals in git
- **Verify:** attempt login with `dev@bharatgrowth.in` / `devpass123` against production → must fail.

### 2. Fix the broken AI bill scanner (retired model)
- [ ] In `src/app/api/vision/scan-bill/route.ts`, replace `claude-sonnet-4-20250514` with `claude-sonnet-5` (exact string, no date suffix — the old model was retired June 15, 2026 and now returns 404)
- **Verify:** run a real scan against a sample supplier bill photo; confirm items come back.

### 3. Move CRON_SECRET out of the URL
- [x] Change `/api/cron/campaigns` to read the secret from an `Authorization: Bearer` header instead of `?secret=` (query strings end up in Vercel/proxy logs)
- [x] Update the Vercel Cron / scheduler config to send the header (`vercel.json` crons entry — Vercel attaches the Bearer header automatically)
- [ ] Rotate `CRON_SECRET` once, since the old value has been logged in URLs *(do this in Vercel env settings)*
- **Verify:** request without header → 401; with header → runs.

---

## P1 — Before inviting pilot shops (days)

### 4. Enforce marketing consent in the campaign engine  ← biggest compliance gap
- [x] Filter campaign matches to customers with `dpdp_marketing_consent = true` (inside `find_campaign_matches()` RPC, migration 037 — plus pre-send re-check in the cron route)
- [x] Capture marketing consent at the point of customer creation (billing quick-add checkbox + optional storefront checkout checkbox, migration 039) and log it to `consent_logs`
- [x] Create the missing `find_campaign_matches` RPC — consent filter lives inside the RPC so it can't be bypassed; JS fallback deleted
- **Verify:** seed one consented and one non-consented customer with qualifying invoices; run the cron; exactly one message logged.

### 5. Build the opt-out path (Meta will ban the number without it)
- [x] Add an inbound WhatsApp webhook route (`/api/whatsapp/webhook`) with Meta signature verification (`X-Hub-Signature-256`)
- [x] On "STOP"/opt-out messages: set `dpdp_marketing_consent = false` across all shops holding that phone + append `consent_logs` rows (`whatsapp_opt_in` / `withdrawn`) — migration 038
- [ ] Add an opt-out instruction line to every marketing template *(part of Meta template submission, item 6)*
- [ ] Register the webhook URL + verify token in Meta App Dashboard; set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` + `WHATSAPP_APP_SECRET` in Vercel
- **Verify:** send STOP from a test number → customer flagged, next cron run skips them.

### 6. Get marketing templates Meta-approved
- [x] Stop injecting free-text `message_template` into a single `{{n}}` variable — campaign rules now carry `template_key` + short `custom_variable` (≤60 chars, migration 036) and send via `sendCampaignMessage`
- [ ] Submit `bg_receipt_v1`, `bg_khata_v1`, `bg_promo_v1`, `bg_reorder_v1`, `bg_new_arrival_v1` for approval in Meta Business Manager (include opt-out footer text)
- [ ] Handle template-rejected / quality-rating responses from the API (log to a table, surface in dashboard)

### 7. Error monitoring
- [ ] Install Sentry (`@sentry/nextjs`) — wire client, server, and edge configs; keep the existing DNS fix in `instrumentation.ts`
- [ ] Add Sentry DSN to Vercel env
- **Verify:** throw a test error in a dev route → appears in Sentry.

### 8. Smoke checklist from MAC_MIGRATION_CHECKLIST.md §7–8
- [ ] `npx supabase link` + `npx supabase db push --dry-run` reports remote up to date
- [ ] `npx vercel link` done on the Mac
- [ ] Run the bounded preview smoke list (idempotency replay, consent rejection, strict stock on online accept, POS foreign-ID rejection, khata reconcile)

---

## P2 — Before switching on marketing at scale (1–2 weeks)

### 9. Tests + CI (highest engineering ROI)
- [ ] Add Vitest; unit-test `src/lib/billing/calculateTotals.ts`: GST slabs (0/5/12/18/28), CGST/SGST vs IGST split, discount handling, paise rounding, round-off
- [ ] Unit-test `validateInvoice.ts` and GSTIN validation
- [ ] Add `.github/workflows/ci.yml`: `tsc --noEmit` → `lint` → `test` → `build` on every push/PR (CLAUDE.md already claims this pipeline exists)
- **Verify:** push a branch with a deliberately broken GST rate → CI fails.

### 10. Server-authoritative POS totals & GST (known fast-follow)
- [ ] `save_invoice` v4: recompute line taxable amounts, GST breakup, discounts, round-off, and grand total server-side from catalog prices + submitted quantities; reject or correct mismatched client totals
- [ ] Manual (non-catalog) lines: recompute tax from submitted unit price + GST rate; validate rate ∈ {0,5,12,18,28}
- [ ] Compute `loyalty_ledger.running_balance` inside the RPC (currently client-supplied → race-condition corruption)
- **Verify:** POST a tampered payload (wrong `total_paise`) → invoice saved with correct server-computed totals or rejected.

### 11. Atomic AI-scan quota decrement
- [ ] Replace read-then-update in `scan-bill/route.ts` with a single conditional `UPDATE ... SET monthly_ai_scans = monthly_ai_scans - 1 WHERE monthly_ai_scans > 0 RETURNING` (or RPC)
- [ ] Add Zod validation + a size cap (e.g. 4 MB base64) on `image_base64`
- [ ] Switch route auth from `getSession()` to `getUser()` / `requireShopUser()`

### 12. Rate limiting on public + messaging APIs
- [ ] Per-IP limit on `/api/storefront/checkout` (order-spam protection; stock is safe but pending-order spam isn't)
- [ ] Per-shop daily caps on WhatsApp sends (protects number quality rating)
- [ ] Simple counter table or Upstash-style limiter; return 429 with Retry-After

### 13. GSTIN checksum validation
- [ ] Implement the mod-36 checksum in `src/lib/validators/schema.ts` (regex currently checks format only; CLAUDE.md requires checksum)

---

## P3 — Before paid / public launch

### 14. Close the loyalty loop — redemption
- [ ] Redeem flow at POS (points → discount on current bill), `entry_type: 'redeem'` in `loyalty_ledger`, server-computed balance check (no negative balances)
- [ ] Show points balance on the WhatsApp receipt / public receipt page
- *Rationale: retention is the moat; earn-only points don't retain anyone.*

### 15. Monetization plumbing
- [ ] Razorpay subscriptions (Free/Pro tiers) — currently no Razorpay integration exists despite CLAUDE.md
- [ ] WhatsApp marketing credit packs + per-shop send metering

### 16. Positioning-claim features (schedule honestly or de-scope the claims)
- [ ] Offline-capable billing (service worker + IndexedDB queue + sync) — currently absent
- [ ] Hindi/English bilingual UI (i18n framework + number formatting) — currently absent
- [ ] E-invoicing (IRN via NIC) for >₹5cr shops, credit/debit notes, thermal print layout — Phase 4 roadmap

### 17. Housekeeping
- [ ] Fix the 23 lint warnings (unused vars) — `npm run lint -- --fix` covers one; delete the rest by hand
- [ ] Split `billing/page.tsx` (1,339 lines) and `dashboard/page.tsx` (979 lines) into components before they get harder to change
- [ ] DPDP right-to-erasure: an actual deletion/anonymization flow for customer data (consent revoke exists; erasure doesn't)

---

*Review basis: commit `8c38909`, all 35 migrations, API routes, and RLS policies; local gate (tsc/lint/build/audit) passed clean on macOS.*
