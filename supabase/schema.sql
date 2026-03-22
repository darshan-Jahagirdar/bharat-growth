-- =============================================================================
-- BharatGrowth: Multi-Tenant Database Schema for Indian SMB Billing SaaS
-- =============================================================================
-- Stack:        Supabase (Postgres 15+)
-- Multi-tenancy: shop_id on every table + Row-Level Security (RLS)
-- Money:        All amounts in paise (integer), never float
-- Compliance:   DPDP Act 2026, GST Rule 46, WhatsApp Business Policy
-- RLS pattern:  (SELECT get_current_shop_id()) — subquery for plan-time caching
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at on every row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Indian financial year: April 1 → March 31 (e.g., '2025-26')
CREATE OR REPLACE FUNCTION get_financial_year(d date DEFAULT CURRENT_DATE)
RETURNS varchar(7) AS $$
BEGIN
  IF EXTRACT(MONTH FROM d) >= 4 THEN
    RETURN EXTRACT(YEAR FROM d)::text || '-' ||
           SUBSTRING((EXTRACT(YEAR FROM d) + 1)::text FROM 3);
  ELSE
    RETURN (EXTRACT(YEAR FROM d) - 1)::text || '-' ||
           SUBSTRING(EXTRACT(YEAR FROM d)::text FROM 3);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Resolve current user's shop_id from Supabase Auth context
-- SECURITY DEFINER: runs with elevated privileges to read users table
-- STABLE: Postgres caches result within a single statement
-- Usage in RLS: always wrap as (SELECT get_current_shop_id()) for initplan optimization
CREATE OR REPLACE FUNCTION get_current_shop_id()
RETURNS uuid AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.users WHERE id = (SELECT auth.uid());
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Prevent any mutation on consent_logs (DPDP Act immutability)
CREATE OR REPLACE FUNCTION prevent_consent_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_logs is append-only: % operations are not permitted', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- DPDP Act 2026: Anonymize customer PII while preserving invoice integrity
-- Clears phone, name, email, address but keeps customer_id for FK references
-- Logs an erasure_request in consent_logs for audit trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION anonymize_customer(
  p_customer_id uuid,
  p_shop_id     uuid,
  p_requested_by uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_anon_token text;
BEGIN
  v_anon_token := 'ERASED-' || p_customer_id::text;

  -- 1. Anonymize customer record — replace PII with deterministic placeholder
  UPDATE customers
  SET
    phone_number              = v_anon_token,
    name                      = 'Anonymized Customer',
    email                     = NULL,
    address                   = NULL,
    gstin                     = NULL,
    notes                     = NULL,
    dpdp_data_consent         = false,
    dpdp_marketing_consent    = false,
    dpdp_data_sharing_consent = false,
    consent_collected_at      = now(),
    updated_at                = now()
  WHERE id = p_customer_id
    AND shop_id = p_shop_id;

  -- 2. Log the erasure request in consent_logs (immutable audit trail)
  INSERT INTO consent_logs (
    shop_id, customer_id, purpose, status,
    consent_method, collected_by, metadata
  ) VALUES (
    p_shop_id, p_customer_id, 'erasure_request', 'granted',
    'in_app', p_requested_by,
    jsonb_build_object(
      'action', 'pii_anonymized',
      'anonymized_at', now()::text,
      'fields_cleared', ARRAY['phone_number','name','email','address','gstin','notes']
    )
  );

  -- NOTE: Invoice customer_name/customer_phone snapshots are NOT touched.
  -- GST law requires preserving invoice data as-is at time of billing.
  -- The customer_id FK on invoices remains intact for historical queries.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SHOPS (Root tenant table — the anchor for all multi-tenancy)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE shops (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name           text NOT NULL,
  legal_name              text,
  gstin                   varchar(15) CHECK (
                            gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$'
                          ),
  pan                     varchar(10),
  -- GST registration type: determines invoice format
  -- 'regular'     → Tax Invoice with CGST/SGST/IGST breakup
  -- 'composition' → Bill of Supply — NO tax component shown on invoice
  gst_type                text NOT NULL DEFAULT 'regular' CHECK (
                            gst_type IN ('regular', 'composition')
                          ),
  business_type           text NOT NULL CHECK (
                            business_type IN ('tyre_shop', 'sweet_stall', 'garment_store', 'general')
                          ),
  address_line_1          text,
  address_line_2          text,
  city                    text,
  state_code              varchar(2) NOT NULL,    -- GST state code (01-37), drives CGST/SGST vs IGST
  pincode                 varchar(6),
  phone                   varchar(15),
  email                   text,
  logo_url                text,
  subscription_plan       text NOT NULL DEFAULT 'free' CHECK (
                            subscription_plan IN ('free', 'pro', 'enterprise')
                          ),
  subscription_valid_until timestamptz,
  e_invoicing_enabled     boolean NOT NULL DEFAULT false,
  settings                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shops_gstin ON shops (gstin) WHERE gstin IS NOT NULL;
CREATE INDEX idx_shops_business_type ON shops (business_type);

CREATE TRIGGER set_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. USERS (Linked to Supabase Auth — RBAC: owner/manager/cashier)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  phone           varchar(15),
  role            text NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_shop_id ON users (shop_id);
CREATE INDEX idx_users_shop_role ON users (shop_id, role);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRODUCTS (Catalog with GST tax slabs + vertical-specific JSONB attrs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name                text NOT NULL,
  sku                 text,
  hsn_code            varchar(8) NOT NULL,          -- 4/6/8 digit HSN
  gst_rate_percent    smallint NOT NULL CHECK (gst_rate_percent IN (0, 5, 12, 18, 28)),
  unit_price_paise    bigint NOT NULL CHECK (unit_price_paise >= 0),
  selling_price_paise bigint NOT NULL CHECK (selling_price_paise >= 0),
  unit                text NOT NULL DEFAULT 'piece' CHECK (
                        unit IN ('piece','kg','g','litre','ml','metre','set','pair','box')
                      ),
  category            text,
  is_active           boolean NOT NULL DEFAULT true,
  barcode             text,                          -- EAN-13 or shop-generated
  vertical_attrs      jsonb NOT NULL DEFAULT '{}',   -- tyre:{brand,size} sweet:{weight_g,is_perishable} garment:{size,color}
  image_url           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_shop_name ON products (shop_id, name);
CREATE UNIQUE INDEX idx_products_shop_sku ON products (shop_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_products_shop_barcode ON products (shop_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_shop_hsn ON products (shop_id, hsn_code);
CREATE INDEX idx_products_shop_category ON products (shop_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_products_shop_active ON products (shop_id) WHERE is_active = true;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CUSTOMERS (Phone number is the primary business identifier in India)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone_number              varchar(15) NOT NULL,    -- Primary identifier for Indian SMBs
  name                      text,                    -- Often unknown on first visit
  email                     text,
  address                   text,
  gstin                     varchar(15),             -- For B2B customers
  segment                   text NOT NULL DEFAULT 'new' CHECK (
                              segment IN ('new', 'regular', 'vip', 'dormant')
                            ),
  total_spent_paise         bigint NOT NULL DEFAULT 0,   -- Denormalized for quick segmentation
  visit_count               integer NOT NULL DEFAULT 0,
  last_visit_at             timestamptz,
  -- DPDP Act 2026 consent flags (convenience; authoritative log in consent_logs)
  dpdp_data_consent         boolean NOT NULL DEFAULT false,
  dpdp_marketing_consent    boolean NOT NULL DEFAULT false,
  dpdp_data_sharing_consent boolean NOT NULL DEFAULT false,
  consent_collected_at      timestamptz,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Phone number unique WITHIN a shop (same person can be customer at multiple shops)
CREATE UNIQUE INDEX idx_customers_shop_phone ON customers (shop_id, phone_number);
CREATE INDEX idx_customers_shop_name ON customers (shop_id, name) WHERE name IS NOT NULL;
CREATE INDEX idx_customers_shop_segment ON customers (shop_id, segment);
CREATE INDEX idx_customers_shop_last_visit ON customers (shop_id, last_visit_at);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INVOICES (GST-compliant bills with CGST/SGST/IGST breakup)
-- ─────────────────────────────────────────────────────────────────────────────

-- Sequential, gap-free invoice numbering per shop per financial year
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_shop_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS text AS $$
DECLARE
  v_fy          varchar(7);
  v_next_seq    integer;
BEGIN
  -- Serialize per-shop to prevent race conditions in concurrent billing
  PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || get_financial_year(p_date)));

  v_fy := get_financial_year(p_date);

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = p_shop_id AND financial_year = v_fy;

  RETURN 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_number      text NOT NULL,
  invoice_sequence    integer NOT NULL,                -- Numeric sequence within FY
  financial_year      varchar(7) NOT NULL,             -- e.g., '2025-26'
  invoice_date        date NOT NULL DEFAULT CURRENT_DATE,
  invoice_type        text NOT NULL DEFAULT 'regular' CHECK (
                        invoice_type IN ('regular', 'credit_note', 'debit_note', 'proforma')
                      ),
  -- Document type: derived from shop's gst_type
  -- 'tax_invoice'     → Regular GST shops — shows full tax breakup
  -- 'bill_of_supply'  → Composition scheme — NO tax lines on invoice
  document_type       text NOT NULL DEFAULT 'tax_invoice' CHECK (
                        document_type IN ('tax_invoice', 'bill_of_supply')
                      ),

  -- Customer snapshot (frozen at invoice time — GST legal requirement)
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,   -- NULL = walk-in
  customer_name       text,
  customer_phone      varchar(15),
  customer_gstin      varchar(15),                     -- For B2B invoices

  -- GST geography (determines CGST+SGST vs IGST)
  billing_state_code  varchar(2) NOT NULL,
  is_inter_state      boolean NOT NULL DEFAULT false,

  -- Amounts in paise
  subtotal_paise      bigint NOT NULL,                 -- Sum of line items pre-tax
  cgst_total_paise    bigint NOT NULL DEFAULT 0,       -- 0 for composition shops
  sgst_total_paise    bigint NOT NULL DEFAULT 0,       -- 0 for composition shops
  igst_total_paise    bigint NOT NULL DEFAULT 0,       -- 0 for composition shops
  discount_paise      bigint NOT NULL DEFAULT 0,
  round_off_paise     bigint NOT NULL DEFAULT 0,       -- Indian practice: round to ₹1
  total_paise         bigint NOT NULL,                 -- Final payable amount

  -- Payment
  payment_mode        text NOT NULL DEFAULT 'cash' CHECK (
                        payment_mode IN ('cash', 'upi', 'card', 'credit', 'split')
                      ),
  payment_reference   text,                            -- UPI txn ID, card last-4, etc.

  -- Status
  status              text NOT NULL DEFAULT 'completed' CHECK (
                        status IN ('draft', 'completed', 'cancelled', 'returned')
                      ),

  -- E-invoicing (for turnover > ₹5 crore)
  irn                 text,                            -- Invoice Reference Number from NIC
  irn_generated_at    timestamptz,

  -- Credit/debit note linkage
  original_invoice_id uuid REFERENCES invoices(id),

  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Soft delete (financial records are never hard-deleted)
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invoices_shop_number ON invoices (shop_id, invoice_number);
CREATE INDEX idx_invoices_shop_fy ON invoices (shop_id, financial_year, created_at DESC);
CREATE INDEX idx_invoices_shop_customer ON invoices (shop_id, customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX idx_invoices_shop_date ON invoices (shop_id, invoice_date);
CREATE INDEX idx_invoices_shop_status ON invoices (shop_id, status);
CREATE INDEX idx_invoices_shop_payment ON invoices (shop_id, payment_mode);
CREATE INDEX idx_invoices_shop_created ON invoices (shop_id, created_at DESC);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. INVOICE ITEMS (Line items with per-item GST breakup)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE invoice_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,  -- Denormalized for RLS perf
  invoice_id            uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id            uuid REFERENCES products(id) ON DELETE SET NULL,

  -- Product snapshot (frozen at billing time)
  product_name          text NOT NULL,
  hsn_code              varchar(8) NOT NULL,
  quantity              numeric(10,3) NOT NULL CHECK (quantity > 0),
  unit                  text NOT NULL,
  unit_price_paise      bigint NOT NULL,

  -- Tax computation (all zeroes for composition/bill_of_supply invoices)
  discount_paise        bigint NOT NULL DEFAULT 0,
  taxable_amount_paise  bigint NOT NULL,             -- (qty × unit_price) − discount
  gst_rate_percent      smallint NOT NULL,
  cgst_paise            bigint NOT NULL DEFAULT 0,
  sgst_paise            bigint NOT NULL DEFAULT 0,
  igst_paise            bigint NOT NULL DEFAULT 0,
  total_paise           bigint NOT NULL,             -- taxable + tax (or just taxable for composition)

  batch_number          text,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_shop_invoice ON invoice_items (shop_id, invoice_id);
CREATE INDEX idx_invoice_items_shop_product ON invoice_items (shop_id, product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX idx_invoice_items_shop_hsn ON invoice_items (shop_id, hsn_code);

CREATE TRIGGER set_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. LOYALTY LEDGER (Points earned vs. redeemed — running balance pattern)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE loyalty_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  entry_type      text NOT NULL CHECK (
                    entry_type IN ('earn', 'redeem', 'expire', 'adjust')
                  ),
  points          integer NOT NULL,                  -- Positive for earn, negative for redeem
  running_balance integer NOT NULL,                  -- Balance AFTER this entry
  description     text,
  expires_at      timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_shop_customer ON loyalty_ledger (shop_id, customer_id, created_at DESC);
CREATE INDEX idx_loyalty_shop_invoice ON loyalty_ledger (shop_id, invoice_id)
  WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_loyalty_shop_type ON loyalty_ledger (shop_id, customer_id, entry_type);
CREATE INDEX idx_loyalty_expiry ON loyalty_ledger (shop_id, expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TRIGGER set_loyalty_ledger_updated_at
  BEFORE UPDATE ON loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CONSENT LOGS (DPDP Act 2026 — IMMUTABLE APPEND-ONLY AUDIT TRAIL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE consent_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose         text NOT NULL CHECK (
                    purpose IN (
                      'data_collection',
                      'whatsapp_marketing',
                      'data_sharing',
                      'analytics',
                      'erasure_request'
                    )
                  ),
  status          text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  consent_method  text NOT NULL CHECK (
                    consent_method IN ('in_app', 'whatsapp_opt_in', 'verbal_recorded', 'sms', 'paper')
                  ),
  ip_address      inet,
  user_agent      text,
  collected_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
  -- NOTE: No updated_at, no deleted_at — this table is IMMUTABLE
);

CREATE INDEX idx_consent_shop_customer_purpose ON consent_logs
  (shop_id, customer_id, purpose, created_at DESC);
CREATE INDEX idx_consent_shop_customer ON consent_logs
  (shop_id, customer_id, created_at DESC);
CREATE INDEX idx_consent_shop_purpose_status ON consent_logs
  (shop_id, purpose, status);

-- IMMUTABILITY TRIGGER: Block all UPDATE and DELETE operations
CREATE TRIGGER consent_logs_immutable
  BEFORE UPDATE OR DELETE ON consent_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_consent_log_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. INVENTORY (Stock tracking with batch/expiry support)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE inventory (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number        text,
  quantity_in_stock   numeric(10,3) NOT NULL DEFAULT 0,
  reorder_level       numeric(10,3),
  cost_price_paise    bigint,
  expiry_date         date,
  manufacturing_date  date,
  location            text,
  supplier_name       text,
  supplier_phone      varchar(15),
  last_restocked_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_inventory_shop_product_batch ON inventory
  (shop_id, product_id, COALESCE(batch_number, '__no_batch__'));
CREATE INDEX idx_inventory_shop_product ON inventory (shop_id, product_id);
CREATE INDEX idx_inventory_expiry ON inventory (shop_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE TRIGGER set_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. INVENTORY MOVEMENTS (Audit trail for all stock changes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE inventory_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  inventory_id    uuid NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  movement_type   text NOT NULL CHECK (
                    movement_type IN ('sale', 'purchase', 'return', 'adjustment', 'damage', 'expired')
                  ),
  quantity_change  numeric(10,3) NOT NULL,
  quantity_after   numeric(10,3) NOT NULL,
  reference_id     uuid,
  reference_type   text CHECK (
                     reference_type IN ('invoice', 'purchase_order', 'manual')
                   ),
  reason           text,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_movements_shop_inv ON inventory_movements
  (shop_id, inventory_id, created_at DESC);
CREATE INDEX idx_inv_movements_shop_type ON inventory_movements
  (shop_id, movement_type, created_at);
CREATE INDEX idx_inv_movements_ref ON inventory_movements
  (shop_id, reference_id) WHERE reference_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Current consent status per customer per purpose (latest entry wins)
CREATE VIEW current_consent AS
SELECT DISTINCT ON (shop_id, customer_id, purpose)
  shop_id,
  customer_id,
  purpose,
  status,
  consent_method,
  created_at AS consented_at
FROM consent_logs
ORDER BY shop_id, customer_id, purpose, created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. ROW-LEVEL SECURITY (Data isolation for 1,000+ shops)
-- ─────────────────────────────────────────────────────────────────────────────
-- Pattern: (SELECT get_current_shop_id()) wraps the function in a subquery
-- so Postgres evaluates it once as an InitPlan, not per-row. This is the
-- 2026 best practice for Supabase RLS performance at scale.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable + Force RLS on ALL tables
ALTER TABLE shops              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE shops              FORCE ROW LEVEL SECURITY;
ALTER TABLE users              FORCE ROW LEVEL SECURITY;
ALTER TABLE products           FORCE ROW LEVEL SECURITY;
ALTER TABLE customers          FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices           FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      FORCE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger     FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_logs       FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory          FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;

-- ── SHOPS ──
CREATE POLICY shops_select ON shops
  FOR SELECT USING (id = (SELECT get_current_shop_id()));

CREATE POLICY shops_update ON shops
  FOR UPDATE USING (id = (SELECT get_current_shop_id()))
  WITH CHECK (id = (SELECT get_current_shop_id()));

-- ── USERS ──
CREATE POLICY users_select ON users
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY users_update ON users
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── PRODUCTS ──
CREATE POLICY products_select ON products
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY products_insert ON products
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY products_update ON products
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY products_delete ON products
  FOR DELETE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('owner', 'manager'))
  );

-- ── CUSTOMERS ──
CREATE POLICY customers_select ON customers
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY customers_insert ON customers
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY customers_update ON customers
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVOICES ──
CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY invoices_insert ON invoices
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY invoices_update ON invoices
  FOR UPDATE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'owner')
  );

-- ── INVOICE ITEMS ──
CREATE POLICY invoice_items_select ON invoice_items
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY invoice_items_insert ON invoice_items
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── LOYALTY LEDGER ──
CREATE POLICY loyalty_select ON loyalty_ledger
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY loyalty_insert ON loyalty_ledger
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── CONSENT LOGS (append-only: INSERT + SELECT only) ──
CREATE POLICY consent_logs_select ON consent_logs
  FOR SELECT USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'owner')
  );

CREATE POLICY consent_logs_insert ON consent_logs
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVENTORY ──
CREATE POLICY inventory_select ON inventory
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY inventory_insert ON inventory
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY inventory_update ON inventory
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVENTORY MOVEMENTS ──
CREATE POLICY inv_movements_select ON inventory_movements
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));

CREATE POLICY inv_movements_insert ON inventory_movements
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
