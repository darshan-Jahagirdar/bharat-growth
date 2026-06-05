-- =========================================================================
-- Migration 026: Fix adjust_stock Function Overloading
--
-- P0 FIX: Migration 021 created adjust_stock with 8 parameters.
-- Migration 025 used CREATE OR REPLACE with 10 parameters, but since
-- the signatures differ, Postgres treated them as TWO overloaded
-- functions — causing "Could not choose the best candidate function"
-- ambiguity errors when called from the client.
--
-- This migration:
--   1. Drops ALL known signatures of adjust_stock
--   2. Re-creates the single definitive 10-param version (from Phase 27)
--      with proper DEFAULT values so it can be called with 4-10 args
-- =========================================================================

-- ── Drop the old 8-param signature (from migration 021) ──
DROP FUNCTION IF EXISTS adjust_stock(
  uuid, uuid, numeric, text, text, uuid, text, boolean
);

-- ── Drop the new 10-param signature (from migration 025) ──
DROP FUNCTION IF EXISTS adjust_stock(
  uuid, uuid, numeric, text, text, uuid, text, boolean, bigint, uuid
);

-- ── Re-create the single definitive version ──
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

  -- ── Update product on purchase: cost price + auto-enable stock tracking ──
  IF p_movement_type = 'purchase' THEN
    UPDATE products
    SET purchase_price_paise = COALESCE(
          CASE WHEN p_unit_price_paise IS NOT NULL AND p_unit_price_paise > 0
               THEN p_unit_price_paise ELSE NULL END,
          purchase_price_paise
        ),
        is_stock_tracked = true,
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
