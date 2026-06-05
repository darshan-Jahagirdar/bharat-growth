-- =========================================================================
-- Migration 027: Atomic save_purchase_bill RPC
--
-- Replaces the frontend's sequential adjust_stock loop (N HTTP round-trips)
-- with a single Postgres transaction that:
--   1. Inserts the purchase_bill header
--   2. Loops through items: UPSERT inventory, write audit trail, update product
--   3. Returns bill_id + items_processed count
--
-- Scalability: 1 RPC call instead of N, single connection, full atomicity.
-- =========================================================================

CREATE OR REPLACE FUNCTION save_purchase_bill(
  p_bill   jsonb,   -- { shop_id, supplier_name, bill_number, bill_date, total_amount_paise, created_by }
  p_items  jsonb    -- array of { product_id, quantity, unit_price_paise }
)
RETURNS jsonb AS $$
DECLARE
  v_bill_id        uuid;
  v_shop_id        uuid;
  v_supplier       text;
  v_bill_number    text;
  v_item           jsonb;
  v_product_id     uuid;
  v_qty            numeric(10,3);
  v_unit_price     bigint;
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
  v_total_value    bigint;
  v_success_count  integer := 0;
BEGIN
  v_shop_id    := (p_bill->>'shop_id')::uuid;
  v_supplier   := p_bill->>'supplier_name';
  v_bill_number := COALESCE(p_bill->>'bill_number', 'N/A');

  IF v_shop_id IS NULL OR v_supplier IS NULL THEN
    RAISE EXCEPTION 'shop_id and supplier_name are required';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. Insert purchase_bill header
  -- ═══════════════════════════════════════════════════════════════════════
  v_bill_id := gen_random_uuid();

  INSERT INTO purchase_bills (
    id, shop_id, supplier_name, bill_number, bill_date,
    total_amount_paise, created_by
  ) VALUES (
    v_bill_id,
    v_shop_id,
    v_supplier,
    NULLIF(p_bill->>'bill_number', ''),
    COALESCE((p_bill->>'bill_date')::date, CURRENT_DATE),
    COALESCE((p_bill->>'total_amount_paise')::bigint, 0),
    (p_bill->>'created_by')::uuid
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. Process each item: inventory UPSERT + audit + product update
  --    Sequential within one transaction = no lost updates, full atomicity
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price_paise')::bigint;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;  -- skip invalid rows
    END IF;

    -- ── UPSERT inventory row ──
    SELECT id, quantity_in_stock
    INTO v_inv_id, v_current_stock
    FROM inventory
    WHERE shop_id = v_shop_id AND product_id = v_product_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_inv_id IS NULL THEN
      INSERT INTO inventory (shop_id, product_id, quantity_in_stock)
      VALUES (v_shop_id, v_product_id, 0)
      RETURNING id, quantity_in_stock INTO v_inv_id, v_current_stock;
    END IF;

    v_new_stock := v_current_stock + v_qty;

    -- ── Update inventory (cost price + restock timestamp) ──
    UPDATE inventory
    SET quantity_in_stock = v_new_stock,
        cost_price_paise = COALESCE(
          CASE WHEN v_unit_price IS NOT NULL AND v_unit_price > 0
               THEN v_unit_price ELSE NULL END,
          cost_price_paise
        ),
        last_restocked_at = now(),
        updated_at = now()
    WHERE id = v_inv_id;

    -- ── Calculate total value ──
    v_total_value := COALESCE(v_unit_price, 0) * ABS(v_qty)::bigint;

    -- ── Audit trail ──
    INSERT INTO inventory_movements (
      shop_id, inventory_id, movement_type,
      quantity_change, quantity_after,
      reference_id, reference_type, reason,
      total_value_paise, purchase_bill_id
    ) VALUES (
      v_shop_id, v_inv_id, 'purchase',
      v_qty, v_new_stock,
      v_bill_id, 'purchase_bill',
      'Purchase from ' || v_supplier || ' — Bill #' || v_bill_number,
      v_total_value, v_bill_id
    );

    -- ── Auto-enable stock tracking + update purchase price ──
    UPDATE products
    SET purchase_price_paise = COALESCE(
          CASE WHEN v_unit_price IS NOT NULL AND v_unit_price > 0
               THEN v_unit_price ELSE NULL END,
          purchase_price_paise
        ),
        is_stock_tracked = true,
        updated_at = now()
    WHERE id = v_product_id;

    v_success_count := v_success_count + 1;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. Return result
  -- ═══════════════════════════════════════════════════════════════════════
  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'items_processed', v_success_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
