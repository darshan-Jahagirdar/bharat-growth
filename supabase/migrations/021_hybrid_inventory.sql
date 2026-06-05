-- =========================================================================
-- Migration 021: Smart Hybrid Inventory Engine (Phase 26)
-- Adds is_stock_tracked + low_stock_threshold to products,
-- and the adjust_stock RPC with UPSERT + audit trail.
-- =========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. New columns on products
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_stock_tracked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. adjust_stock RPC — UPSERT inventory + audit trail
--    p_allow_negative = false → strict block (online storefront)
--    p_allow_negative = true  → soft block (offline POS, allows negative)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION adjust_stock(
  p_shop_id        uuid,
  p_product_id     uuid,
  p_quantity_change numeric(10,3),
  p_movement_type  text,
  p_notes          text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL,
  p_reference_type text DEFAULT 'manual',
  p_allow_negative boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
BEGIN
  -- ── UPSERT: find or create inventory row ──
  SELECT id, quantity_in_stock
  INTO v_inv_id, v_current_stock
  FROM inventory
  WHERE shop_id = p_shop_id AND product_id = p_product_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_inv_id IS NULL THEN
    -- Auto-create inventory row with starting stock = 0
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
      updated_at = now()
  WHERE id = v_inv_id;

  -- ── Audit trail ──
  INSERT INTO inventory_movements (
    shop_id, inventory_id, movement_type,
    quantity_change, quantity_after,
    reference_id, reference_type, reason
  ) VALUES (
    p_shop_id, v_inv_id, p_movement_type,
    p_quantity_change, v_new_stock,
    p_reference_id, p_reference_type, p_notes
  );

  RETURN jsonb_build_object(
    'inventory_id', v_inv_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'change', p_quantity_change
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Public read on inventory for storefront stock display
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Public read inventory stock"
  ON inventory FOR SELECT
  TO anon
  USING (true);
