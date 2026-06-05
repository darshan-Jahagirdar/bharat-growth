-- =========================================================================
-- Migration 029: Order Engine Schema (Phase 29.1)
--
-- Upgrades the POS into a Vertical ERP with Purchase Orders (PO) and
-- Sales Orders (SO). Four new tables + two gap-free sequence generators.
--
-- Tables: purchase_orders, purchase_order_items,
--         sales_orders, sales_order_items
-- RPCs:   get_next_po_number, get_next_so_number
--
-- All tables have shop_id, RLS ENABLED + FORCED, policies use
-- get_current_shop_id(). Sequence generators use pg_advisory_xact_lock
-- for race-condition-free numbering (identical to invoice pattern).
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PURCHASE ORDERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE purchase_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  po_number          text NOT NULL,
  po_sequence        integer NOT NULL,
  financial_year     varchar(7) NOT NULL,
  supplier_name      text NOT NULL,
  status             text NOT NULL DEFAULT 'draft' CHECK (
                       status IN ('draft', 'sent', 'fulfilled', 'cancelled')
                     ),
  expected_date      date,
  total_amount_paise bigint NOT NULL DEFAULT 0,
  notes              text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_po_shop_number ON purchase_orders (shop_id, po_number);
CREATE INDEX idx_po_shop_fy ON purchase_orders (shop_id, financial_year, created_at DESC);
CREATE INDEX idx_po_shop_status ON purchase_orders (shop_id, status);
CREATE INDEX idx_po_shop_supplier ON purchase_orders (shop_id, supplier_name);
CREATE INDEX idx_po_shop_created ON purchase_orders (shop_id, created_at DESC);

CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PURCHASE ORDER ITEMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE purchase_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  po_id               uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity            numeric(10,3) NOT NULL,
  expected_price_paise bigint NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_po_id ON purchase_order_items (po_id);
CREATE INDEX idx_poi_shop ON purchase_order_items (shop_id);

CREATE TRIGGER set_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SALES ORDERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sales_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  so_number          text NOT NULL,
  so_sequence        integer NOT NULL,
  financial_year     varchar(7) NOT NULL,
  customer_id        uuid REFERENCES customers(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'draft' CHECK (
                       status IN ('draft', 'reserved', 'fulfilled', 'cancelled')
                     ),
  valid_until        timestamptz,
  total_amount_paise bigint NOT NULL DEFAULT 0,
  notes              text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_so_shop_number ON sales_orders (shop_id, so_number);
CREATE INDEX idx_so_shop_fy ON sales_orders (shop_id, financial_year, created_at DESC);
CREATE INDEX idx_so_shop_status ON sales_orders (shop_id, status);
CREATE INDEX idx_so_shop_customer ON sales_orders (shop_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_so_shop_created ON sales_orders (shop_id, created_at DESC);

CREATE TRIGGER set_sales_orders_updated_at BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SALES ORDER ITEMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sales_order_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  so_id              uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id         uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity           numeric(10,3) NOT NULL,
  agreed_price_paise bigint NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_soi_so_id ON sales_order_items (so_id);
CREATE INDEX idx_soi_shop ON sales_order_items (shop_id);

CREATE TRIGGER set_sales_order_items_updated_at BEFORE UPDATE ON sales_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY — ENABLE + FORCE on all 4 tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items     ENABLE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders       FORCE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_orders          FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items     FORCE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS POLICIES — Standard multi-tenant guard on all 4 tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PURCHASE ORDERS ──
CREATE POLICY po_select ON purchase_orders
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY po_insert ON purchase_orders
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY po_update ON purchase_orders
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY po_delete ON purchase_orders
  FOR DELETE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('owner', 'manager'))
  );

-- ── PURCHASE ORDER ITEMS ──
CREATE POLICY poi_select ON purchase_order_items
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY poi_insert ON purchase_order_items
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY poi_update ON purchase_order_items
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY poi_delete ON purchase_order_items
  FOR DELETE USING (shop_id = (SELECT get_current_shop_id()));

-- ── SALES ORDERS ──
CREATE POLICY so_select ON sales_orders
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY so_insert ON sales_orders
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY so_update ON sales_orders
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY so_delete ON sales_orders
  FOR DELETE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('owner', 'manager'))
  );

-- ── SALES ORDER ITEMS ──
CREATE POLICY soi_select ON sales_order_items
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY soi_insert ON sales_order_items
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY soi_update ON sales_order_items
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY soi_delete ON sales_order_items
  FOR DELETE USING (shop_id = (SELECT get_current_shop_id()));


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. SEQUENCE GENERATORS — Gap-free PO/SO numbering
--    Pattern: pg_advisory_xact_lock prevents race conditions
--    Format: PO/2025-26/00001, SO/2025-26/00001
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Purchase Order Number Generator ──
CREATE OR REPLACE FUNCTION get_next_po_number(p_shop_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS text AS $$
DECLARE
  v_fy       varchar(7);
  v_next_seq integer;
BEGIN
  v_fy := get_financial_year(p_date);

  -- Lock per shop+FY to prevent concurrent duplicates
  PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || 'PO' || v_fy));

  SELECT COALESCE(MAX(po_sequence), 0) + 1 INTO v_next_seq
  FROM purchase_orders
  WHERE shop_id = p_shop_id AND financial_year = v_fy;

  RETURN 'PO/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Sales Order Number Generator ──
CREATE OR REPLACE FUNCTION get_next_so_number(p_shop_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS text AS $$
DECLARE
  v_fy       varchar(7);
  v_next_seq integer;
BEGIN
  v_fy := get_financial_year(p_date);

  -- Lock per shop+FY to prevent concurrent duplicates
  PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::text || 'SO' || v_fy));

  SELECT COALESCE(MAX(so_sequence), 0) + 1 INTO v_next_seq
  FROM sales_orders
  WHERE shop_id = p_shop_id AND financial_year = v_fy;

  RETURN 'SO/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
