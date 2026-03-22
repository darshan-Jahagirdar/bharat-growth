# BharatGrowth — Project Bible

> **Vertical SaaS for Indian SMBs** — Desktop-first billing + automated WhatsApp loyalty marketing
> Target verticals: Tyre Shops, Sweet Stalls, Garment Stores

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 14+ (App Router) | Desktop-optimized, keyboard-driven |
| **Backend/DB** | Supabase (Postgres + Auth + Edge Functions + Realtime) | Mumbai region for data residency |
| **Auth** | Supabase Auth | Phone OTP primary, RBAC via custom claims |
| **Payments** | Razorpay | SaaS subscriptions + UPI QR for shops |
| **Messaging** | WhatsApp Business API (Cloud API) | Loyalty campaigns + transactional |
| **Hosting** | Vercel | Edge-optimized, preview deployments |
| **CI/CD** | GitHub Actions | Lint → Test → Deploy pipeline |
| **Monitoring** | Sentry + Supabase Dashboard | Error tracking + DB metrics |

## Architecture Principles

- **Multi-tenant**: Shared Postgres schema, `tenant_id` on every table, RLS enforced
- **Desktop-first**: Optimize for 1366x768, keyboard shortcuts, no mobile-first
- **Offline-capable**: Service workers for billing flows, sync on reconnect
- **Speed-billing**: Invoice generation < 5 seconds end-to-end
- **Bilingual**: Hindi/English with Indian number formatting (₹1,23,456)

## Regulatory Compliance (MANDATORY)

### Indian Digital Personal Data Protection (DPDP) Act 2026
- **Explicit consent** required before collecting any personal data
- **Purpose limitation**: Data used only for stated purpose
- **Data minimization**: Collect only what's necessary
- **Right to erasure**: Users can request complete data deletion
- **Data localization**: Indian user data stored in India (Supabase Mumbai)
- **Consent manager**: Must maintain auditable consent records
- **Breach notification**: 72-hour mandatory reporting to DPBI

### GST Billing Rules
- Invoices must comply with **Rule 46 of CGST Rules 2017**
- Mandatory fields: GSTIN, HSN/SAC codes, tax breakup (CGST+SGST/IGST)
- Sequential invoice numbering per financial year (April-March)
- **E-invoicing**: Mandatory for turnover > ₹5 crore (IRN via NIC portal)
- Tax slabs: 0%, 5%, 12%, 18%, 28% — correctly applied per HSN code
- Credit/debit notes must reference original invoice number
- GSTIN validation with checksum verification

### WhatsApp Business Policy
- Explicit opt-in before any marketing messages
- Template messages pre-approved by Meta
- 24-hour customer service window rules
- Opt-out mechanism in every marketing message

## Coding Conventions

- TypeScript strict mode — no `any` types
- Supabase client via `createServerClient` / `createBrowserClient` pattern
- All DB queries through typed Supabase client (generated types from schema)
- Zod for runtime validation at API boundaries
- Tailwind CSS for styling — no CSS modules
- `snake_case` for DB columns, `camelCase` for TypeScript
- All financial amounts stored as integers (paise, not rupees)
- UTC timestamps in DB, IST display in UI

## Agent Swarm

All agent personas live in `.claude/agents/`. Each agent has a defined mission and domain boundary. The **Project Shipper** coordinates all agents. See individual agent files for detailed responsibilities.

## Key Business Context

- **Competitors**: Vyapar, Khatabook, myBillBook, Zoho Invoice
- **Wedge**: Speed-billing (fastest invoice generation)
- **Moat**: WhatsApp loyalty marketing automation
- **ICP**: Single-store Indian SMBs doing 20-200 bills/day
- **Pricing**: Freemium billing → paid WhatsApp marketing credits
