-- =========================================================================
-- Migration 028: Emergency Security Patch — RPC Tenant Isolation
--
-- CRITICAL FIX: All three SECURITY DEFINER RPCs (save_invoice,
-- save_purchase_bill, adjust_stock) accepted caller-supplied shop_id
-- without validating that auth.uid() belongs to that shop. A malicious
-- authenticated user could pass another shop's UUID and write data
-- across tenant boundaries.
--
-- This migration:
--   1. Patches save_invoice — ownership guard after shop_id extraction
--   2. Patches save_purchase_bill — ownership guard after shop_id extraction
--   3. Patches adjust_stock — ownership guard at function entry
--   4. Patches get_current_shop_id — adds is_active check (LOW severity)
--
-- All function signatures remain identical (CREATE OR REPLACE).
-- No schema changes, no new tables, no data migration.
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PATCH: get_current_shop_id() — add is_active check
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_current_shop_id()
RETURNS uuid AS $$
  SELECT shop_id FROM public.users
  WHERE id = (SELECT auth.uid()) AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PATCH: save_invoice — add tenant ownership validation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION save_invoice(
  p_invoice       jsonb,
  p_items         jsonb,
  p_loyalty_entry jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invoice_id     uuid;
  v_shop_id        uuid;
  v_customer_id    uuid;
  v_payment_mode   text;
  v_total_paise    bigint;
  v_fy             varchar(7);
  v_next_seq       integer;
  v_invoice_number text;
  v_item           jsonb;
  v_result         jsonb;
  v_product_id     uuid;
  v_qty            numeric(10,3);
  v_is_tracked     boolean;
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
BEGIN
  -- ── Extract shop_id and validate ──
  v_shop_id := (p_invoice->>'shop_id')::uuid;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  -- ══ SECURITY PATCH: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;

  v_customer_id  := (p_invoice->>'customer_id')::uuid;
  v_payment_mode := COALESCE(p_invoice->>'payment_mode', 'cash');
  v_total_paise  := (p_invoice->>'total_paise')::bigint;

  -- ── Generate sequential invoice number (with advisory lock) ──
  v_fy := get_financial_year((p_invoice->>'invoice_date')::date);

  PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || v_fy));

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = v_shop_id AND financial_year = v_fy;

  v_invoice_number := 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
  v_invoice_id := gen_random_uuid();

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. Insert invoice
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    id, shop_id, invoice_number, invoice_sequence, financial_year,
    invoice_date, invoice_type, document_type,
    customer_id, customer_name, customer_phone, customer_gstin,
    billing_state_code, is_inter_state,
    subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
    discount_paise, round_off_paise, total_paise,
    payment_mode, payment_reference, status, created_by
  ) VALUES (
    v_invoice_id,
    v_shop_id,
    v_invoice_number,
    v_next_seq,
    v_fy,
    COALESCE((p_invoice->>'invoice_date')::date, CURRENT_DATE),
    COALESCE(p_invoice->>'invoice_type', 'regular'),
    COALESCE(p_invoice->>'document_type', 'tax_invoice'),
    v_customer_id,
    p_invoice->>'customer_name',
    p_invoice->>'customer_phone',
    p_invoice->>'customer_gstin',
    COALESCE(p_invoice->>'billing_state_code', '27'),
    COALESCE((p_invoice->>'is_inter_state')::boolean, false),
    (p_invoice->>'subtotal_paise')::bigint,
    COALESCE((p_invoice->>'cgst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'sgst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'igst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'discount_paise')::bigint, 0),
    COALESCE((p_invoice->>'round_off_paise')::bigint, 0),
    v_total_paise,
    v_payment_mode,
    p_invoice->>'payment_reference',
    'completed',
    (p_invoice->>'created_by')::uuid
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. Insert all invoice items + atomic inventory deduction
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_items (
      id, shop_id, invoice_id, product_id,
      product_name, hsn_code, quantity, unit, unit_price_paise,
      discount_paise, taxable_amount_paise, gst_rate_percent,
      cgst_paise, sgst_paise, igst_paise, total_paise,
      batch_number
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      v_invoice_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'hsn_code',
      (v_item->>'quantity')::numeric,
      v_item->>'unit',
      (v_item->>'unit_price_paise')::bigint,
      COALESCE((v_item->>'discount_paise')::bigint, 0),
      (v_item->>'taxable_amount_paise')::bigint,
      (v_item->>'gst_rate_percent')::smallint,
      COALESCE((v_item->>'cgst_paise')::bigint, 0),
      COALESCE((v_item->>'sgst_paise')::bigint, 0),
      COALESCE((v_item->>'igst_paise')::bigint, 0),
      (v_item->>'total_paise')::bigint,
      v_item->>'batch_number'
    );

    -- ── Atomic inventory deduction for tracked products ──
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    SELECT is_stock_tracked INTO v_is_tracked
    FROM products
    WHERE id = v_product_id;

    IF v_is_tracked THEN
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

      v_new_stock := v_current_stock - v_qty;

      UPDATE inventory
      SET quantity_in_stock = v_new_stock,
          updated_at = now()
      WHERE id = v_inv_id;

      INSERT INTO inventory_movements (
        shop_id, inventory_id, movement_type,
        quantity_change, quantity_after,
        reference_id, reference_type, reason
      ) VALUES (
        v_shop_id, v_inv_id, 'sale',
        -v_qty, v_new_stock,
        v_invoice_id, 'invoice',
        'POS Invoice ' || v_invoice_number
      );
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. Insert loyalty entry (if provided)
  -- ═══════════════════════════════════════════════════════════════════════
  IF p_loyalty_entry IS NOT NULL AND p_loyalty_entry->>'customer_id' IS NOT NULL THEN
    INSERT INTO loyalty_ledger (
      id, shop_id, customer_id, invoice_id,
      entry_type, points, running_balance, description
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      (p_loyalty_entry->>'customer_id')::uuid,
      v_invoice_id,
      COALESCE(p_loyalty_entry->>'entry_type', 'earn'),
      (p_loyalty_entry->>'points')::integer,
      (p_loyalty_entry->>'running_balance')::integer,
      COALESCE(p_loyalty_entry->>'description', 'Purchase ' || v_invoice_number)
    );

    UPDATE customers SET
      total_spent_paise = total_spent_paise + v_total_paise,
      visit_count = visit_count + 1,
      last_visit_at = now()
    WHERE id = (p_loyalty_entry->>'customer_id')::uuid
      AND shop_id = v_shop_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. KHATA (CREDIT) ENGINE
  -- ═══════════════════════════════════════════════════════════════════════
  IF v_payment_mode = 'credit' AND v_customer_id IS NOT NULL AND v_total_paise > 0 THEN
    INSERT INTO credit_ledger (
      id, shop_id, customer_id, invoice_id,
      amount_paise, transaction_type, notes
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      v_customer_id,
      v_invoice_id,
      v_total_paise,
      'credit_given',
      'Invoice ' || v_invoice_number
    );

    UPDATE customers
    SET credit_balance_paise = credit_balance_paise + v_total_paise
    WHERE id = v_customer_id
      AND shop_id = v_shop_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. ATTRIBUTION LOOP
  -- ═══════════════════════════════════════════════════════════════════════
  IF v_customer_id IS NOT NULL THEN
    UPDATE message_logs
    SET converted_at          = now(),
        conversion_invoice_id = v_invoice_id
    WHERE id = (
      SELECT ml.id
      FROM message_logs ml
      WHERE ml.customer_id  = v_customer_id
        AND ml.shop_id      = v_shop_id
        AND ml.converted_at IS NULL
        AND ml.sent_at      >= now() - interval '14 days'
      ORDER BY ml.sent_at DESC
      LIMIT 1
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. B2B GSTIN PERSISTENCE
  -- ═══════════════════════════════════════════════════════════════════════
  IF v_customer_id IS NOT NULL
     AND (p_invoice->>'customer_gstin') IS NOT NULL
     AND length(p_invoice->>'customer_gstin') = 15
  THEN
    UPDATE customers SET
      gstin = p_invoice->>'customer_gstin',
      updated_at = now()
    WHERE id = v_customer_id
      AND shop_id = v_shop_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- Return the created invoice summary
  -- ═══════════════════════════════════════════════════════════════════════
  v_result := jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'invoice_sequence', v_next_seq,
    'financial_year', v_fy,
    'total_paise', v_total_paise
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PATCH: save_purchase_bill — add tenant ownership validation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION save_purchase_bill(
  p_bill   jsonb,
  p_items  jsonb
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

  -- ══ SECURITY PATCH: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
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
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price_paise')::bigint;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
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

    v_total_value := COALESCE(v_unit_price, 0) * ABS(v_qty)::bigint;

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


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PATCH: adjust_stock — add tenant ownership validation
--    Must DROP + re-CREATE because signature includes defaults
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS adjust_stock(uuid, uuid, numeric, text, text, uuid, text, boolean, bigint, uuid);

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
  -- ══ SECURITY PATCH: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', p_shop_id;
  END IF;

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
