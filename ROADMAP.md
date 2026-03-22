# BharatGrowth — Execution Roadmap

---

## Phase 1: Speed-Billing Desktop Engine (Weeks 1–6)
> *Goal: A shopkeeper can sign up and generate a GST-compliant bill in under 3 minutes*

### Multi-Tenant Database Schema
- [ ] Design core schema: `tenants`, `users`, `roles`, `products`, `invoices`, `invoice_items`, `customers`
- [ ] Implement Row-Level Security (RLS) policies on all tables with `tenant_id`
- [ ] Set up Supabase Auth with phone OTP + RBAC (Owner/Manager/Cashier)
- [ ] Create seed data scripts for 3 verticals (tyre, sweets, garments)
- [ ] Write migration scripts with rollback support

### Speed-Billing UI
- [ ] Build desktop-optimized billing page (1366x768 baseline)
- [ ] Implement keyboard-shortcut-driven invoice flow (F-keys, Tab navigation)
- [ ] Product search with fuzzy matching (< 100ms response)
- [ ] Real-time invoice total with GST breakup (CGST + SGST)
- [ ] Thermal printer invoice layout (58mm/80mm)
- [ ] Barcode scanner input integration

### GST Compliance Engine
- [ ] Tax slab computation logic (0%, 5%, 12%, 18%, 28%)
- [ ] HSN code lookup and validation
- [ ] GSTIN validation with checksum algorithm
- [ ] Sequential invoice numbering (FY-scoped)
- [ ] Invoice PDF generation (Rule 46 compliant)

### Onboarding
- [ ] Phone OTP signup flow (no email required)
- [ ] Industry template selection (tyre/sweet/garment)
- [ ] Guided first-bill wizard with pre-loaded sample products
- [ ] Business profile setup (GSTIN, address, logo)

**Phase 1 Exit Criteria:** 10 pilot shopkeepers generating real bills daily

---

## Phase 2: Customer & Loyalty Engine (Weeks 7–12)
> *Goal: Shopkeepers can track customers and send WhatsApp loyalty messages*

### Customer Management
- [ ] Customer database with phone number as primary key
- [ ] Purchase history per customer (linked to invoices)
- [ ] Customer segmentation (new/regular/VIP/dormant)
- [ ] Customer search and quick-add during billing
- [ ] DPDP Act consent capture and management

### WhatsApp Integration
- [ ] WhatsApp Business API setup via Cloud API
- [ ] Transactional messages: invoice receipt via WhatsApp
- [ ] Template message approval workflow with Meta
- [ ] Opt-in/opt-out management (DPDP compliant)
- [ ] Message delivery tracking and analytics

### Basic Loyalty Programs
- [ ] Visit-based rewards ("Buy 5, get 1 free")
- [ ] Birthday/anniversary automated greetings
- [ ] Dormant customer re-engagement campaigns
- [ ] WhatsApp campaign builder (template-based)

**Phase 2 Exit Criteria:** 50 shops active, 1000+ WhatsApp messages sent/week

---

## Phase 3: Intelligence & Growth (Weeks 13–18)
> *Goal: Data-driven insights and self-serve growth engine*

### Analytics Dashboard
- [ ] Daily/weekly/monthly sales summary
- [ ] Top products and category-wise breakdown
- [ ] Customer acquisition and retention metrics
- [ ] WhatsApp campaign ROI tracking
- [ ] CA/accountant export (CSV/Excel)

### Inventory Management
- [ ] Stock tracking with low-stock alerts
- [ ] Batch and expiry management (for sweets)
- [ ] Size/variant matrix (for garments and tyres)
- [ ] Purchase order creation for suppliers
- [ ] Stock adjustment logging (damage/theft)

### Growth Loops
- [ ] Referral program (shopkeeper-to-shopkeeper)
- [ ] WhatsApp-based onboarding for referred shops
- [ ] Freemium → paid conversion nudges
- [ ] In-app reviews and NPS collection

**Phase 3 Exit Criteria:** 200 shops, 30% using WhatsApp marketing, 10% paid

---

## Phase 4: Scale & Monetize (Weeks 19–26)
> *Goal: Sustainable unit economics and multi-vertical expansion*

### Advanced Billing
- [ ] E-invoicing integration (IRN via NIC portal)
- [ ] Multi-counter billing (parallel cashiers)
- [ ] Credit/debit note management
- [ ] Quotation and proforma invoice support
- [ ] Recurring invoice scheduling

### Subscription & Payments
- [ ] Razorpay subscription billing integration
- [ ] Tiered pricing (Free / Pro / Enterprise)
- [ ] WhatsApp marketing credit packs
- [ ] UPI QR code on invoices for customer payments
- [ ] Payment reconciliation dashboard

### Platform Hardening
- [ ] Offline-first sync engine (conflict resolution)
- [ ] Multi-device session management
- [ ] Automated backup and point-in-time recovery
- [ ] Performance optimization (< 3s page loads on 4GB RAM)
- [ ] Security audit and penetration testing

### Expansion
- [ ] New vertical templates (pharmacy, hardware, grocery)
- [ ] Multi-store management for growing businesses
- [ ] Staff attendance and basic payroll
- [ ] Supplier payment tracking

**Phase 4 Exit Criteria:** 1000 shops, positive unit economics, Series A ready
