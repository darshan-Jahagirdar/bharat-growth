-- =========================================================================
-- Migration 005: Invoices + Invoice Items + Sequential Numbering
-- =========================================================================

-- Gap-free invoice numbering per shop per financial year
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_shop_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS text AS $$
DECLARE
  v_fy       varchar(7);
  v_next_seq integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || get_financial_year(p_date)));
  v_fy := get_financial_year(p_date);
  SELECT COALESCE(MAX(invoice_sequence), 0) + 1 INTO v_next_seq
  FROM invoices WHERE shop_id = p_shop_id AND financial_year = v_fy;
  RETURN 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_number      text NOT NULL,
  invoice_sequence    integer NOT NULL,
  financial_year      varchar(7) NOT NULL,
  invoice_date        date NOT NULL DEFAULT CURRENT_DATE,
  invoice_type        text NOT NULL DEFAULT 'regular' CHECK (
                        invoice_type IN ('regular','credit_note','debit_note','proforma')
                      ),
  document_type       text NOT NULL DEFAULT 'tax_invoice' CHECK (
                        document_type IN ('tax_invoice', 'bill_of_supply')
                      ),
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name       text,
  customer_phone      varchar(15),
  customer_gstin      varchar(15),
  billing_state_code  varchar(2) NOT NULL,
  is_inter_state      boolean NOT NULL DEFAULT false,
  subtotal_paise      bigint NOT NULL,
  cgst_total_paise    bigint NOT NULL DEFAULT 0,
  sgst_total_paise    bigint NOT NULL DEFAULT 0,
  igst_total_paise    bigint NOT NULL DEFAULT 0,
  discount_paise      bigint NOT NULL DEFAULT 0,
  round_off_paise     bigint NOT NULL DEFAULT 0,
  total_paise         bigint NOT NULL,
  payment_mode        text NOT NULL DEFAULT 'cash' CHECK (
                        payment_mode IN ('cash','upi','card','credit','split')
                      ),
  payment_reference   text,
  status              text NOT NULL DEFAULT 'completed' CHECK (
                        status IN ('draft','completed','cancelled','returned')
                      ),
  irn                 text,
  irn_generated_at    timestamptz,
  original_invoice_id uuid REFERENCES invoices(id),
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invoices_shop_number ON invoices (shop_id, invoice_number);
CREATE INDEX idx_invoices_shop_fy ON invoices (shop_id, financial_year, created_at DESC);
CREATE INDEX idx_invoices_shop_customer ON invoices (shop_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_invoices_shop_date ON invoices (shop_id, invoice_date);
CREATE INDEX idx_invoices_shop_status ON invoices (shop_id, status);
CREATE INDEX idx_invoices_shop_payment ON invoices (shop_id, payment_mode);
CREATE INDEX idx_invoices_shop_created ON invoices (shop_id, created_at DESC);
CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE invoice_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_id           uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id           uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name         text NOT NULL,
  hsn_code             varchar(8) NOT NULL,
  quantity             numeric(10,3) NOT NULL CHECK (quantity > 0),
  unit                 text NOT NULL,
  unit_price_paise     bigint NOT NULL,
  discount_paise       bigint NOT NULL DEFAULT 0,
  taxable_amount_paise bigint NOT NULL,
  gst_rate_percent     smallint NOT NULL,
  cgst_paise           bigint NOT NULL DEFAULT 0,
  sgst_paise           bigint NOT NULL DEFAULT 0,
  igst_paise           bigint NOT NULL DEFAULT 0,
  total_paise          bigint NOT NULL,
  batch_number         text,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_shop_invoice ON invoice_items (shop_id, invoice_id);
CREATE INDEX idx_invoice_items_shop_product ON invoice_items (shop_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_invoice_items_shop_hsn ON invoice_items (shop_id, hsn_code);
CREATE TRIGGER set_invoice_items_updated_at BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
