# BharatGrowth — Claude Session Handoff

**Written:** 2026-07-15 by Claude (Fable), end of a long session, for the next Claude session.
**Companion doc:** Codex maintains its own `docs/bharatgrowth/CODEX_HANDOFF.md` — read that too; it is the source of truth for decomposition/hardening execution state. This file is the **Claude-side** continuity: product understanding, the audit Claude ran, the design phase Claude drove, and what Claude does next.

> Do not trust remembered/compacted state. Re-derive git branch, `git log`, and gate status from disk before acting. If disk contradicts this doc, disk wins — say so.

---

## 0. Corrections (2026-08-02, verified from disk)

Three things earlier handoff/session state got wrong. Verified against the repo;
carry these forward.

1. **`src/components/ui/` is dead code.** All 57 shadcn primitives are
   unreachable — the only reference from outside the folder is a *type-only*
   import in `src/hooks/use-toast.ts`. All 293 token-based colour classes in the
   repo live inside those unused files; the app itself is ~1,526 hardcoded
   Tailwind palette utilities. Consequence: editing the `:root`/`.dark` token
   block alone changes **zero pixels**. Any "change the tokens and it propagates"
   plan is void until a surface actually adopts the primitives. `next-themes`
   and `src/components/theme-provider.tsx` are likewise unused.
2. **The landing page already exists.** `src/app/page.tsx` is 311 lines with a
   Spline 3D embed (`src/components/TunnelSpline.tsx`), live at `/`. It is a
   rewrite target, not a greenfield surface — treat it as a regression risk.
3. **Migrations run to 054** (`054_visit_data_consent.sql`), not 053.

Also landed 2026-08-02: typography (Space Grotesk / Hanken Grotesk / JetBrains
Mono via `next/font`) plus a surface retint and semantic colour vocabulary
(`--color-brand/money/dues/info`) in `src/app/globals.css`. Note Tailwind v4
prunes unused theme variables, so the semantic tokens only emit once a component
uses them. Measured against Tailwind v4's defaults, the grey retint moved
700/800/900 by ≤3/255 (v4's ramp is already slate-tinted); only the 950 base step
changed materially. The visible win was the fonts.

---

## 1. What BharatGrowth is

A **multi-tenant vertical SaaS / ERP for single-store Indian SMBs** — initial verticals: tyre shops, sweet stalls, garment stores, general retail. Solo-founded by **Darshan**.

- **Wedge:** fast, desktop, keyboard-driven **GST billing** (staff do 20–200 bills/day).
- **Moat:** consent-aware **WhatsApp customer retention** built on top of that billing.
- One-line framing (Darshan's): *"a billing app on the surface, but actually an online-shopping + marketing engine that brings customers back."* Positioning: local shops fighting back against online giants — "an identity and a weapon."
- Tenant boundary is `shops.id` / `shop_id`, enforced by Supabase RLS.
- **Pre-launch: NO real users yet** — "production" holds only Darshan's test shops/customers. Security findings are launch gates, not live incidents. This is important — it changes urgency, not the fixes.

The canonical, source-backed feature map is `docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md` (Codex authored it). It separates *implemented* from *planned/marketed*. Never turn a roadmap/landing claim into "existing behavior."

## 2. Implemented features (real, in code)

- **Speed POS billing** — keyboard-driven (F2–F8), fuzzy product search, barcode scanner input, manual + catalog line items, GST computed (CGST/SGST/IGST), paise integer money, FY-scoped sequential invoice numbers via advisory lock.
- **Negative inventory at POS by design** (speed); **strict stock online** (opposite, deliberate).
- **GST correctness** — regular = Tax Invoice with tax breakup; composition = Bill of Supply, no tax. GSTIN format + mod-36 checksum validation (added during hardening).
- **Khata (credit/udhaar)** — credit sales → `credit_ledger` + customer balance; repayment flow; WhatsApp reminders with shop UPI ID.
- **WhatsApp** — digital receipt after each bill (public `/receipt/[id]`), khata reminders, low-stock owner alerts. Simulation mode when no Meta token. Server-authoritative send routes (accept only IDs, load content from DB).
- **Loyalty points** — earned per bill (incl. khata, at sale — intended). Redemption NOT built yet.
- **Online storefront** `/store/[shop_id]` — 3 themes, mobile-oriented, public; checkout with UPI/khata, mandatory data-consent + optional marketing-consent, idempotent, server-authoritative pricing.
- **Orders** — online order accept/reject (strict stock), Sales Orders + Purchase Orders, SO→invoice and PO→bill conversion RPCs.
- **Purchasing** — purchase bills, **AI OCR bill scan** (Claude/GPT vision → line items, monthly quota), stock adjust with movement audit, bulk CSV product upload.
- **Analytics dashboard** — KPIs, revenue trend, top products, khata hitlist, low-stock/anomaly panels, GST CSV export.
- **Auth** — Supabase phone OTP + email magic link. Multi-tenant RLS forced on all tables. Data residency: Supabase Mumbai (bom1).

## 3. The MOATs (the differentiator — this is the whole thesis)

> **Feature ≠ moat (Darshan, 2026-07-15).** Fast GST billing is one of the *most important features* but the *least important moat*. It's the daily workhorse (staff touch it 20–200×/day) and the wedge that wins the door — it must be excellent or shops never adopt. But as a *moat* it's the weakest: Vyapar, Khatabook, myBillBook, Zoho all match it, and it races to free. Never pitch or prioritize billing *as the differentiator*. The differentiator is the return-in-rupees loop below. Excellence in billing = non-negotiable feature; defensibility = items 2–3.

1. **Fast GST billing = the wedge / a top feature, NOT a moat** (gets shops in the door; competitors match this — it's table stakes, a race to free). Keep it excellent (speed, keyboard flow, GST correctness); do not treat it as the differentiator.
2. **The Bring-Back Engine = the real moat, and it's what Claude built this session.** Automated WhatsApp repurchase-cycle campaigns with **rupee-proven attribution**: tag products → campaign fires N days after purchase via Meta-approved template → when the customer returns and buys, `save_invoice` links the sale back to the message → dashboard shows *"₹38,400 brought back this month • 14 customers returned."* **No competitor (Vyapar, Khatabook, myBillBook, Zoho) closes that message→return→₹ loop.** That attributed-ROI number is the entire sales pitch and the reason a shop pays.
3. **The complete online storefront + marketing campaigns are also core moat** (Darshan confirmed 2026-07-15). Not just billing — each shop gets a real mobile storefront where its customers browse and order, wired to the same WhatsApp marketing/campaign engine. Billing → storefront → campaigns → attributed return is one connected retention loop. This end-to-end "shop's own digital identity + marketing engine" is the differentiator, alongside the Bring-Back attribution.
4. Supporting moat pieces: WhatsApp-native khata reminders, per-vertical default campaigns seeded at onboarding, DPDP-compliant consent + opt-out (which keeps the single platform WhatsApp number alive — a banned number kills receipts/khata/campaigns for everyone at once).

## 4. Stack

- **Frontend:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind v4, shadcn/ui, recharts.
- **Backend/data:** Supabase — Postgres, Auth, Storage, Realtime, RLS, RPCs. Money = integer paise across all boundaries. DB timestamps UTC; billing/FY logic in IST.
- **Hosting:** Vercel (Git previews + prod). **CI:** GitHub Actions (typecheck, lint, Vitest, build, Playwright public smoke).
- **Messaging:** WhatsApp Cloud API (+ simulation). **AI scan:** Anthropic/OpenAI vision, model `claude-sonnet-5`.
- **Payments:** shop UPI QR + khata today; **Razorpay planned** (Darshan has API keys — must stay in env vars, never repo).
- **Machine:** Darshan migrated Windows→Mac ~July 2026. Local Docker not always available (some Supabase-local checks must run against linked staging instead).

## 5. The Claude bug audit + its fixes (all resolved)

Claude ran a deep audit (feature-first, to avoid flagging design decisions as bugs). Found **14 confirmed bugs + 1 build break**; three suspected items were confirmed *intended* by Darshan and dropped (discount UI = deferred feature; SO-conversion loyalty/attribution = not required; loyalty-on-khata = intended). Full detail: `docs/bharatgrowth/quality/BUG_FIX_PLAN.md`.

**Headline finding — CRITICAL (F11–F14): anon RLS `USING(true)`** let anyone with the public anon key scrape every shop's invoices/customers/PII, shop GSTIN/PAN, and inventory **cost prices**, platform-wide. (Not a live breach — pre-launch, test data only — but a hard launch gate.)

**Fixed & verified on the hardening branch** via migrations 042–048 (Codex implemented, Claude reviewed and approved):
- **042** additive `get_public_receipt` + `get_storefront_owner_phone` RPCs (expand phase); contract migration (revokes/column-grants) still to land as ~049.
- **043** SO→invoice: fractional-qty ROUND fix (F8) + composition Bill-of-Supply (F9).
- **044** atomic `record_credit_repayment` RPC (F1 khata race/overpay).
- **045/048** loyalty running-balance = locked SUM, order-independent (F2 class).
- **046** atomic `consume_ai_scan` quota. **047** tenant-guard STABLE volatility.
- Also fixed: dev-credential removal (migration 011 neutralized; **but `dev@bharatgrowth.in` must still be deleted from production `auth.users` — repo fix didn't touch the DB, and `devpass123` is in git history**), GSTIN checksum, scan-bill → `requireShopUser` + `claude-sonnet-5`, `failureKind` typecheck break.

Last Claude-run gate (earlier commit): 33 tests, tsc, lint, build all green. **Do not claim current green — re-run before asserting.**

## 6. What we are doing now (decomposition — Codex owns this)

Production-hardening + decomposing the largest mixed-responsibility pages into small, independently-revertible waves. **Currently Wave 6 of 7.**
- Waves 1–5 merged (Billing/POS, Orders, Products, Dashboard, Purchases).
- **Wave 6 = Storefront** (in progress; branch `codex/prepare-wave6-handoff` was doc-only prep).
- **Wave 7 = data-access / query-facade decomposition** (last).
- **Hard rule:** decomposition changes NO behavior — no feature/schema/migration/copy/style/payload/focus/keyboard/RLS/stock/consent/route changes. Integration branch: `codex/production-hardening-baseline`. Prod `main` untouched; fallback tag `pre-hardening-8c38909`.

Why it matters to Claude: splitting the 1,300-line billing page etc. into components is exactly what makes the **frontend reskin (Claude's job) safe**.

## 7. What needs to be done next (roadmap, in order)

1. ~~Codex finishes Waves 6–7 + lands migration 049~~ **DONE on staging (2026-07-18):** all 7 waves merged; §0 loader-RPC fix (PR #12, `3cca263`); migration 049 verified via full 11-line allow/deny matrix and merged (PR #13, integration `e5147d1`). Plan + evidence: `docs/bharatgrowth/database/MIGRATION_049_PLAN.md`. A durable synthetic owner fixture now exists on staging (documented in MIGRATION_RUNBOOK — intentional, do not clean up). **Sale-readiness regression: COMPLETE (2026-07-19, PRs #15/#16).** Result: **1 app defect total** — unauthenticated `/settings` renders the protected nav shell instead of redirecting (UI-guard gap only; RLS/API guards hold, no data exposure; fix pending approval). Ledger + triage addendum: `docs/bharatgrowth/testing/SALE_READINESS_RESULTS.md`. Email magic-link (A2) deferred to the auth rebuild by Darshan's decision; staging Auth redirect config permanently fixed (Site URL + preview wildcard — durable fixture, do not "clean up"). Visual lines V1/V2 waived until post-reskin. **Still open before prod:** `/settings` redirect fix; external blockers (Meta config/templates, prod monitoring test event, rate limiting); the single staged-then-prod rollout (migrations 036–049 + app deploy, explicit approval gate) which also deletes `dev@bharatgrowth.in` from prod `auth.users`; key rotation before first sale. **Parked decision for Darshan:** migration 018 anon-readable customer-images bucket (plan §10.1) — lock down in launch pass or accept. Accepted residual (plan §9): shop/inventory enumeration; full-RPC storefront is the follow-up that closes it.

Then, after decomposition, Darshan's order (confirmed 2026-07-15): **design → payment integration → auth → discounts.**
2. **Design / frontend overhaul** — Claude's main job (see §8). Reskin against the Stitch designs. Wait for decomposition to merge first (components must exist). Designs are NOT finalized yet — Darshan will iterate on them.
3. **Payment integration — Razorpay** — env-var keys only (Darshan has them); webhook signature verify + payment-state reconciliation (mirror the campaign cron's claim-then-act discipline).
4. **Auth** — a redesign/rework is planned (the current `+91`/`91XXXXXXXXXX` OTP behavior is inherited and must be preserved until this approved work; see Codex handoff §4).
5. **Discounts** — engine exists in `calculateTotals`/billing store; needs UI wiring + clamps (no negative discounts; invoice discount ≤ total; pre-tax-per-line for GST compliance).

## 8. Design phase (Claude drove this — status)

Darshan generated **14 of 15 screens in Google Stitch** (Gemini 3 Pro), downloaded each as a folder (`DESIGN.md` + `code.html` + `screen.png`):
- **`designs/`** (desktop): billing, dashboard, login, shop_setup, inventory(products), campaigns, orders, purchase, purchase_log, settings, modals.
- **`designs_mobile/`** (mobile, light theme): storefront, reciept[sic], cart.
- **Design system + per-page prompts:** `docs/bharatgrowth/design/DESIGN_BRIEFS.md`. Status: `docs/bharatgrowth/design/DESIGN_STATUS.md`.
- **Landing page (13) is NOT done** — deliberately last; it's a copy/persuasion problem Claude should do directly (write the "fight back against online giants" narrative + Bring-Back ₹-proof hook, then code/prompt it).
- Design system essentials: dark slate (#0B1120 bg, #0F172A panels), orange accent (#F97316), emerald money/WhatsApp (#10B981), red dues, Space-Grotesk-style headings, monospaced Indian ₹. Storefront/receipt/checkout = light theme. Source of truth for exact colors/spacing = DESIGN_BRIEFS, images = direction.

**OPEN ITEM:** these `designs/` + `designs_mobile/` folders are **untracked and user-owned** (Codex is instructed NOT to touch them). Claude earlier agreed to **push both folders to Google Drive** (`BharatGrowth Designs/`) so the frontend build can read them — this was NOT completed. Next session should offer to do this if Darshan still wants it. (Drive folder id where handoff/brief docs live: `1jJ9xgvYnOWUSpOhIXtdde1SOsyywORmY`.)

When frontend build starts: read `designs/*/code.html` + `screen.png` + DESIGN_BRIEFS, build page-by-page against the EXISTING Tailwind app (reskin markup, do NOT touch logic/queries/RLS), only after decomposition is merged so components exist.

## 9. Docs we maintain (all under `docs/bharatgrowth/`)

- `CODEX_HANDOFF.md` — Codex's durable continuation (read first for exec state).
- `CLAUDE_HANDOFF.md` — this file.
- `CODEX_BRIEF.md` — Darshan/Claude → Codex brief (context-reset + no-real-users + simplified rollout).
- `COLLABORATION_WORKFLOW.md` — repo/Drive/Slack rules, write/readback discipline.
- `product/FEATURE_AND_BEHAVIOR_INVENTORY.md` — source-backed feature map (implemented vs planned).
- `architecture/CURRENT_ARCHITECTURE.md`, `database/MIGRATION_RUNBOOK.md`, `operations/DEPLOYMENT_AND_ROLLBACK.md`.
- `quality/` — `BUG_FIX_PLAN.md`, `DECOMPOSITION_PLAN.md`, `DECOMPOSITION_LOG.md`, `BEHAVIOR_CONTRACTS.md`, `FIX_CHECKLIST.md`.
- `testing/MANUAL_REGRESSION_CHECKLIST.md`, `setup/MAC_MIGRATION_CHECKLIST.md`.
- `design/` — `DESIGN_BRIEFS.md`, `DESIGN_STATUS.md` (+ user's untracked design folders).
- Root `CLAUDE.md` is the compact orientation (project instructions).

## 10. Workflows & collaboration model

- **Roles:** Darshan owns product/priority/approvals. **Codex/Sol** owns careful execution, backend/cross-cutting, verification, cleanup, durable handoff. **Claude** is architecture/review/frontend counterpart (audits are inputs, not a substitute for source verification). Perplexity = deep research, Gemini = broad exploration, when asked.
- **Channels:** GitHub = reviewable code + exact CI (small revertible PRs, CI green, no direct push to `main`). Google Drive (`darshanjahagirdar19@gmail.com`) = human-readable handoff/design mirror. **Slack `#bharatgrowth`** (channel id `C0BG39UE1A9`, workspace `bharatgrowth.slack.com`) = concise verified-milestone feed (post at real milestones with PR links + evidence; never post success on a failed gate). Connectors (Slack/Drive/Calendar) are live on Darshan's account.
- **Darshan's model usage:** switches Claude models (Fable/Opus) via `/model`; watches usage limits closely (sometimes sends "hi" just to gate a session — respond minimally, don't burn the turn on work). Losing a specific model is fine — docs + Drive + memory carry all state.
- **Safety rules that bind everyone:** no secrets in repo/chat/docs ever (Razorpay keys, tokens, OTPs, passwords, phone fixtures). Prod is not an editing surface. Don't reduce urgency into recklessness — pre-launch means "gate," not "skip."

## 11. Resolved with Darshan (2026-07-15)
1. **MOATs** — Bring-Back attribution **+ complete online storefront + marketing campaigns** together (see §3). Confirmed.
2. **Claude's next task** — WAIT for decomposition to finish before frontend. Post-decomposition order: design → payment → auth → discounts (see §7).
3. **Design folders → Drive** — Darshan wants them pushed. Constraint: the `screen.png` files are large binaries; base64-uploading 14 of them through the Drive MCP tool is not feasible inside a near-full context (each PNG is ~130K+ tokens as base64). Recommended path = Darshan drags `designs/` + `designs_mobile/` into Drive manually (30 sec, his folders, zero fidelity loss), OR a fresh-context Claude session pushes the text specs (`DESIGN.md` + `code.html`) programmatically. Designs are NOT finalized — this is a backup, not a build input yet.
