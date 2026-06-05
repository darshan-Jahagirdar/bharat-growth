-- =========================================================================
-- Migration 025: Purchase Ledger (Phase 27)
-- Adds purchase_bills table, purchase_price on products,
-- extends inventory_movements with value tracking + bill reference,
-- adds AI scan quota on shops, and upgrades adjust_stock RPC.
-- =========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Purchase Bills table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase_bills (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_name     text NOT NULL,
  bill_number       text,
  bill_date         date NOT NULL DEFAULT CURRENT_DATE,
  total_amount_paise bigint NOT NULL DEFAULT 0,
  notes             text,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_shop
  ON purchase_bills (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier
  ON purchase_bills (shop_id, supplier_name);

CREATE TRIGGER set_purchase_bills_updated_at BEFORE UPDATE ON purchase_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable + Force RLS
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills FORCE ROW LEVEL SECURITY;

CREATE POLICY purchase_bills_select ON purchase_bills
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY purchase_bills_insert ON purchase_bills
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY purchase_bills_update ON purchase_bills
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY purchase_bills_delete ON purchase_bills
  FOR DELETE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('owner','manager'))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Extend products with purchase_price_paise
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS purchase_price_paise bigint NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Extend inventory_movements with value tracking + purchase_bill FK
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS total_value_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_bill_id uuid REFERENCES purchase_bills(id) ON DELETE SET NULL;

-- Add 'purchase_bill' to the reference_type CHECK constraint
-- Must drop + recreate since inline CHECKs can't be ALTERed
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class r ON c.conrelid = r.oid
  WHERE r.relname = 'inventory_movements'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%reference_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE inventory_movements DROP CONSTRAINT ' || v_constraint_name;
  END IF;
END $$;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_reference_type_check
  CHECK (reference_type IN ('invoice', 'purchase_order', 'manual', 'purchase_bill'));

CREATE INDEX IF NOT EXISTS idx_inv_movements_purchase_bill
  ON inventory_movements (purchase_bill_id) WHERE purchase_bill_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. AI scan quota on shops
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS monthly_ai_scans integer NOT NULL DEFAULT 20;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Upgraded adjust_stock RPC — accepts cost price + purchase bill ref
--    Backwards compatible: new params have defaults.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION adjust_stock(
  p_shop_id          uuid,
  p_product_id       uuid,
  p_quantity_change   numeric(10,3),
  p_movement_type    text,
  p_notes            text DEFAULT NULL,
  p_reference_id     uuid DEFAULT NULL,
  p_reference_type   text DEFAULT 'manual',
  p_allow_negative   boolean DEFAULT false,
  p_unit_price_paise bigint DEFAULT NULL,
  p_purchase_bill_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
  v_total_value    bigint;
BEGIN
  -- ── UPSERT: find or create inventory row ──
  SELECT id, quantity_in_stock
  INTO v_inv_id, v_current_stock
  FROM inventory
  WHERE shop_id = p_shop_id AND product_id = p_product_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_inv_id IS NULL THEN
    INSERT INTO inventory (shop_id, product_id, quantity_in_stock)
    VALUES (p_shop_id, p_product_id, 0)
    RETURNING id, quantity_in_stock INTO v_inv_id, v_current_stock;
  END IF;

  v_new_stock := v_current_stock + p_quantity_change;

  -- ── Strict block: reject if stock would go negative ──
  IF v_new_stock < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock: current=%, requested=%, would result=%',
      v_current_stock, p_quantity_change, v_new_stock;
  END IF;

  -- ── Update inventory ──
  UPDATE inventory
  SET quantity_in_stock = v_new_stock,
      cost_price_paise = COALESCE(
        CASE WHEN p_unit_price_paise IS NOT NULL AND p_movement_type = 'purchase'
             THEN p_unit_price_paise ELSE NULL END,
        cost_price_paise
      ),
      last_restocked_at = CASE WHEN p_movement_type = 'purchase' THEN now() ELSE last_restocked_at END,
      updated_at = now()
  WHERE id = v_inv_id;

  -- ── Calculate total value for this movement ──
  v_total_value := COALESCE(p_unit_price_paise, 0) * ABS(p_quantity_change)::bigint;

  -- ── Audit trail ──
  INSERT INTO inventory_movements (
    shop_id, inventory_id, movement_type,
    quantity_change, quantity_after,
    reference_id, reference_type, reason,
    total_value_paise, purchase_bill_id
  ) VALUES (
    p_shop_id, v_inv_id, p_movement_type,
    p_quantity_change, v_new_stock,
    p_reference_id, p_reference_type, p_notes,
    v_total_value, p_purchase_bill_id
  );

  -- ── Update product purchase_price_paise if this is a purchase ──
  IF p_unit_price_paise IS NOT NULL AND p_movement_type = 'purchase' THEN
    UPDATE products
    SET purchase_price_paise = p_unit_price_paise,
        updated_at = now()
    WHERE id = p_product_id;
  END IF;

  RETURN jsonb_build_object(
    'inventory_id', v_inv_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'change', p_quantity_change,
    'total_value_paise', v_total_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
