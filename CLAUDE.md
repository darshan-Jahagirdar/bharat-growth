# BharatGrowth Project Bible

> Vertical SaaS for Indian SMBs: desktop speed-billing plus consent-aware
> WhatsApp retention. Initial verticals are tyre shops, sweet stalls, garment
> stores, and general retail.

This file is a compact orientation guide. The canonical continuation state is
[`docs/bharatgrowth/CODEX_HANDOFF.md`](docs/bharatgrowth/CODEX_HANDOFF.md), and
the source-backed product contract is
[`docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](docs/bharatgrowth/product/FEATURE_AND_BEHAVIOR_INVENTORY.md).
Read both before structural work.

## Current stack

| Layer | Current implementation | Status note |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind | Protected operator UI is desktop/keyboard-oriented; storefront and receipt are mobile-oriented. |
| Backend/data | Supabase Postgres, Auth, Storage, Realtime, RLS, RPCs | `shops.id` / `shop_id` is the tenant boundary. |
| Auth | Supabase phone OTP and email magic link | Auth/provider redesign is future work. |
| Messaging | WhatsApp Cloud API integration and simulation paths | Production Meta configuration/templates remain external gates. |
| Hosting | Vercel Git previews and production hosting | Decomposition uses staging-only previews; production is untouched. |
| CI | GitHub Actions | Typecheck, lint, Vitest, build, and public smoke. |
| Monitoring | Vercel/Supabase operational surfaces | Production error monitoring/test event remains a launch blocker. |
| Payments | Shop UPI QR and khata behavior exist | Razorpay subscriptions/payment gateway are planned, not current. |

Money crossing application/API/database boundaries is integer paise. Database
timestamps are UTC; documented billing, date-range, and financial-year behavior
uses IST.

## Product and architecture principles

- Fast billing is the wedge; consent-aware customer retention is the moat.
- The primary operator is a single-store owner or staff member processing
  roughly 20–200 bills per day.
- Protected data is scoped through the authenticated user's active
  `users.shop_id` membership and RLS.
- The Receipt UI uses a constrained RPC. The current Storefront loader still
  relies on temporary anonymous compatibility policies for selected table
  fields; constrained RPC/query support exists but the contract cleanup is not
  complete until migration 049 and consumer verification.
- Transactional RPCs own multi-table money, stock, ledger, loyalty, and order
  effects.
- POS may intentionally sell into negative stock; storefront and online order
  paths enforce strict stock.
- Current behavior, copy, visual output, payloads, focus, keyboard, consent,
  RLS, and workflows are frozen during decomposition.
- Planned offline billing, bilingual UI, e-invoicing, subscriptions, loyalty
  redemption, and broad redesign are separate product work.

## Compliance and accounting contracts

These are engineering/product constraints, not a substitute for current legal or
professional review before launch:

- obtain explicit, auditable marketing consent and keep order-data consent
  separate from optional marketing opt-in;
- honor opt-out behavior and use approved provider templates for marketing;
- minimize public/customer data and preserve tenant isolation;
- preserve GST slabs, HSN/GSTIN fields, CGST/SGST versus IGST, composition Bill
  of Supply, sequential financial-year numbering, and paise rounding;
- do not invent e-invoicing, PDF, credit-note, erasure, or other incomplete
  workflows during decomposition.

## Coding conventions

- TypeScript strict mode; avoid untyped boundary data.
- Use the established Supabase server/browser/admin/public client for its
  documented trust boundary.
- Use Zod at API boundaries.
- Keep database columns `snake_case` and TypeScript values `camelCase`.
- Keep financial amounts in paise and preserve item/payload order.
- Extract pure transforms first, controllers/hooks second, focused views last.
- Do not refactor generated/general UI primitives without a demonstrated need.
- Query-facade decomposition belongs only to Wave 7.

## Collaboration roles

- Darshan owns product direction, priorities, locked scope, and approvals.
- Codex / Sol owns implementation, backend/cross-cutting work, verification,
  cleanup, and the durable handoff.
- Claude Code is the architecture/review/frontend counterpart.
- Perplexity is for deep research and Gemini for broad exploration when asked.

GitHub carries reviewable code and exact checks. The existing Google handoff is
the human-readable continuity mirror. `#bharatgrowth` is the concise verified
milestone feed. Follow
[`docs/bharatgrowth/COLLABORATION_WORKFLOW.md`](docs/bharatgrowth/COLLABORATION_WORKFLOW.md)
for target IDs, write/readback rules, and stop conditions.

## Business context

- Competitors: Vyapar, Khatabook, myBillBook, and Zoho Invoice.
- Wedge: fast GST billing.
- Moat: WhatsApp-enabled loyalty and repurchase automation.
- ICP: single-store Indian SMBs doing 20–200 bills per day.
- Intended model: freemium billing leading to paid retention/messaging value.
  Monetization plumbing is not yet a current implemented contract.
