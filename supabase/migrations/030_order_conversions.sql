-- =========================================================================
-- Migration 030: Order Conversion RPCs (Phase 29.2 → 29.7)
--
-- Two SECURITY DEFINER functions that atomically convert orders into
-- finalized financial documents:
--
--   1. convert_po_to_bill  — Purchase Order → Purchase Bill + stock in
--   2. convert_so_to_invoice — Sales Order → Tax Invoice + stock out + khata
--
-- Both functions contain the Phase 28.5 ownership guard and perform
-- all inventory, movement, and ledger writes within a single transaction.
-- They do NOT call save_invoice / save_purchase_bill internally —
-- all logic is inlined to avoid JSON serialization overhead.
--
-- Phase 29.7 FIXES (Architectural Audit Remediation):
--   FIX #1: SELECT ... FOR UPDATE on order headers prevents
--           double-fulfillment race (TOCTOU vulnerability)
--   FIX #2: Race-safe inventory UPSERT using SELECT FOR UPDATE +
--           subtransaction INSERT with unique_violation exception handler.
--           Prevents duplicate inventory rows and lost-update races when
--           two concurrent conversions reference the same product.
--   FIX (v2 carry-forward): Invoice header inserted BEFORE items loop
--           to satisfy invoice_items_invoice_id_fkey FK constraint.
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. convert_po_to_bill
--    Purchase Order → Purchase Bill + Inventory Stock-In
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION convert_po_to_bill(
  p_po_id        uuid,
  p_bill_number  text DEFAULT NULL,
  p_created_by   uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_shop_id        uuid;
  v_supplier       text;
  v_po_status      text;
  v_po_total       bigint;
  v_bill_id        uuid;
  v_item           RECORD;
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
  v_total_value    bigint;
  v_items_count    integer := 0;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════
  -- FIX #1: FOR UPDATE acquires a row-level exclusive lock on the PO.
  -- A concurrent transaction calling convert_po_to_bill on the same PO
  -- will BLOCK here until this transaction commits, then see
  -- status = 'fulfilled' and hit the double-fulfillment exception.
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT shop_id, supplier_name, status, total_amount_paise
  INTO v_shop_id, v_supplier, v_po_status, v_po_total
  FROM purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Purchase order % not found', p_po_id;
  END IF;

  -- ══ SECURITY GUARD: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;

  -- ── Prevent double-fulfillment ──
  IF v_po_status = 'fulfilled' THEN
    RAISE EXCEPTION 'Purchase order % is already fulfilled', p_po_id;
  END IF;

  IF v_po_status = 'cancelled' THEN
    RAISE EXCEPTION 'Purchase order % is cancelled and cannot be converted', p_po_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. Create purchase_bills header FIRST (before item loop)
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO purchase_bills (
    shop_id, supplier_name, bill_number, bill_date,
    total_amount_paise, created_by
  ) VALUES (
    v_shop_id,
    v_supplier,
    COALESCE(NULLIF(p_bill_number, ''), 'PO-' || p_po_id::text),
    CURRENT_DATE,
    v_po_total,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_bill_id;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. Loop through PO items: stock in + audit + product update
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_item IN
    SELECT poi.product_id, poi.quantity, poi.expected_price_paise
    FROM purchase_order_items poi
    WHERE poi.po_id = p_po_id AND poi.product_id IS NOT NULL
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    -- ═════════════════════════════════════════════════════════════════════
    -- FIX #2: Race-safe inventory UPSERT
    --
    -- Pattern: SELECT FOR UPDATE → if not found → INSERT in subtransaction
    --          → if unique_violation (lost race) → re-SELECT FOR UPDATE
    --
    -- Why not INSERT ON CONFLICT? The unique index uses an expression:
    --   (shop_id, product_id, COALESCE(batch_number, '__no_batch__'))
    -- which makes ON CONFLICT inference unreliable across Postgres versions.
    -- The subtransaction pattern is provably correct and version-safe.
    -- ═════════════════════════════════════════════════════════════════════
    SELECT id, quantity_in_stock
    INTO v_inv_id, v_current_stock
    FROM inventory
    WHERE shop_id = v_shop_id
      AND product_id = v_item.product_id
      AND batch_number IS NULL
    FOR UPDATE;

    IF v_inv_id IS NULL THEN
      BEGIN
        INSERT INTO inventory (shop_id, product_id, quantity_in_stock)
        VALUES (v_shop_id, v_item.product_id, 0)
        RETURNING id, quantity_in_stock INTO v_inv_id, v_current_stock;
      EXCEPTION WHEN unique_violation THEN
        -- Lost race: another transaction created the row first.
        -- Their transaction has committed, so the row is now visible.
        SELECT id, quantity_in_stock
        INTO v_inv_id, v_current_stock
        FROM inventory
        WHERE shop_id = v_shop_id
          AND product_id = v_item.product_id
          AND batch_number IS NULL
        FOR UPDATE;
      END;
    END IF;

    v_new_stock := v_current_stock + v_item.quantity;

    -- ── Update inventory (stock + cost price + restock timestamp) ──
    UPDATE inventory
    SET quantity_in_stock = v_new_stock,
        cost_price_paise = COALESCE(
          CASE WHEN v_item.expected_price_paise IS NOT NULL AND v_item.expected_price_paise > 0
               THEN v_item.expected_price_paise ELSE NULL END,
          cost_price_paise
        ),
        last_restocked_at = now(),
        updated_at = now()
    WHERE id = v_inv_id;

    -- ── Calculate total value ──
    v_total_value := COALESCE(v_item.expected_price_paise, 0) * ABS(v_item.quantity)::bigint;

    -- ── Audit trail ──
    INSERT INTO inventory_movements (
      shop_id, inventory_id, movement_type,
      quantity_change, quantity_after,
      reference_id, reference_type, reason,
      total_value_paise, purchase_bill_id
    ) VALUES (
      v_shop_id, v_inv_id, 'purchase',
      v_item.quantity, v_new_stock,
      v_bill_id, 'purchase_bill',
      'PO Fulfillment from ' || v_supplier,
      v_total_value, v_bill_id
    );

    -- ── Auto-enable stock tracking + update purchase price on product ──
    UPDATE products
    SET purchase_price_paise = COALESCE(
          CASE WHEN v_item.expected_price_paise IS NOT NULL AND v_item.expected_price_paise > 0
               THEN v_item.expected_price_paise ELSE NULL END,
          purchase_price_paise
        ),
        is_stock_tracked = true,
        updated_at = now()
    WHERE id = v_item.product_id;

    v_items_count := v_items_count + 1;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. Mark PO as fulfilled
  -- ═══════════════════════════════════════════════════════════════════════
  UPDATE purchase_orders
  SET status = 'fulfilled',
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'items_processed', v_items_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. convert_so_to_invoice
--    Sales Order → Tax Invoice + Inventory Deduction + Khata Engine
--
--    FIX (v2): Invoice header is now inserted BEFORE the items loop so that
--    the FK constraint invoice_items_invoice_id_fkey is satisfied. Totals are
--    accumulated during the loop and then patched onto the header via UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION convert_so_to_invoice(
  p_so_id        uuid,
  p_payment_mode text,
  p_created_by   uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_shop_id        uuid;
  v_customer_id    uuid;
  v_so_status      text;
  v_so_total       bigint;
  v_invoice_id     uuid;
  v_fy             varchar(7);
  v_next_seq       integer;
  v_invoice_number text;
  v_item           RECORD;
  v_product        RECORD;
  v_inv_id         uuid;
  v_current_stock  numeric(10,3);
  v_new_stock      numeric(10,3);
  v_taxable        bigint;
  v_gst_rate       smallint;
  v_cgst           bigint;
  v_sgst           bigint;
  v_item_total     bigint;
  v_total_gst      bigint;
  v_items_count    integer := 0;
  v_subtotal       bigint := 0;
  v_cgst_total     bigint := 0;
  v_sgst_total     bigint := 0;
  v_customer_name  text;
  v_customer_phone varchar(15);
  v_state_code     varchar(2);
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════
  -- FIX #1: FOR UPDATE acquires a row-level exclusive lock on the SO.
  -- A concurrent transaction calling convert_so_to_invoice on the same SO
  -- will BLOCK here until this transaction commits, then see
  -- status = 'fulfilled' and hit the double-fulfillment exception.
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT so.shop_id, so.customer_id, so.status, so.total_amount_paise
  INTO v_shop_id, v_customer_id, v_so_status, v_so_total
  FROM sales_orders so
  WHERE so.id = p_so_id
  FOR UPDATE;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Sales order % not found', p_so_id;
  END IF;

  -- ══ SECURITY GUARD: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;

  -- ── Prevent double-fulfillment ──
  IF v_so_status = 'fulfilled' THEN
    RAISE EXCEPTION 'Sales order % is already fulfilled', p_so_id;
  END IF;

  IF v_so_status = 'cancelled' THEN
    RAISE EXCEPTION 'Sales order % is cancelled and cannot be converted', p_so_id;
  END IF;

  -- ── Fetch customer details (if linked) ──
  IF v_customer_id IS NOT NULL THEN
    SELECT name, phone_number
    INTO v_customer_name, v_customer_phone
    FROM customers
    WHERE id = v_customer_id AND shop_id = v_shop_id;
  END IF;

  -- ── Fetch shop billing state code ──
  SELECT COALESCE(s.state_code, '27')
  INTO v_state_code
  FROM shops s WHERE s.id = v_shop_id;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. Generate sequential invoice number (with advisory lock)
  -- ═══════════════════════════════════════════════════════════════════════
  v_fy := get_financial_year(CURRENT_DATE);

  PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || v_fy));

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = v_shop_id AND financial_year = v_fy;

  v_invoice_number := 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. Insert invoice header FIRST (with zeroed totals — will UPDATE later)
  --    This MUST happen before invoice_items to satisfy the FK constraint.
  -- ═══════════════════════════════════════════════════════════════════════
  INSERT INTO invoices (
    shop_id, invoice_number, invoice_sequence, financial_year,
    invoice_date, invoice_type, document_type,
    customer_id, customer_name, customer_phone,
    billing_state_code, is_inter_state,
    subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
    discount_paise, round_off_paise, total_paise,
    payment_mode, status, created_by
  ) VALUES (
    v_shop_id,
    v_invoice_number,
    v_next_seq,
    v_fy,
    CURRENT_DATE,
    'regular',
    'tax_invoice',
    v_customer_id,
    v_customer_name,
    v_customer_phone,
    v_state_code,
    false,                  -- intra-state default
    0,                      -- placeholder subtotal (updated after loop)
    0,                      -- placeholder cgst
    0,                      -- placeholder sgst
    0,                      -- igst = 0 for intra-state
    0,                      -- discount
    0,                      -- round-off
    0,                      -- placeholder total (updated after loop)
    COALESCE(p_payment_mode, 'cash'),
    'completed',
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_invoice_id;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. Loop through SO items: build invoice items + deduct inventory
  --    The parent invoice row now exists — FK is satisfied.
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_item IN
    SELECT soi.product_id, soi.quantity, soi.agreed_price_paise
    FROM sales_order_items soi
    WHERE soi.so_id = p_so_id AND soi.product_id IS NOT NULL
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    -- ── Fetch product details for invoice line item ──
    SELECT p.name, p.hsn_code, p.gst_rate_percent, p.unit, p.is_stock_tracked
    INTO v_product
    FROM products p
    WHERE p.id = v_item.product_id;

    IF v_product IS NULL THEN
      CONTINUE;  -- product deleted, skip
    END IF;

    -- ── Calculate tax breakup (intra-state: CGST + SGST split) ──
    v_taxable := v_item.agreed_price_paise * v_item.quantity::bigint;
    v_gst_rate := v_product.gst_rate_percent;
    v_total_gst := ROUND(v_taxable * v_gst_rate / 100.0)::bigint;
    v_cgst := ROUND(v_total_gst / 2.0)::bigint;
    v_sgst := v_total_gst - v_cgst;
    v_item_total := v_taxable + v_cgst + v_sgst;

    -- ── Accumulate totals ──
    v_subtotal := v_subtotal + v_taxable;
    v_cgst_total := v_cgst_total + v_cgst;
    v_sgst_total := v_sgst_total + v_sgst;

    -- ── Insert invoice item (parent invoice row already exists) ──
    INSERT INTO invoice_items (
      id, shop_id, invoice_id, product_id,
      product_name, hsn_code, quantity, unit, unit_price_paise,
      discount_paise, taxable_amount_paise, gst_rate_percent,
      cgst_paise, sgst_paise, igst_paise, total_paise
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      v_invoice_id,
      v_item.product_id,
      v_product.name,
      v_product.hsn_code,
      v_item.quantity,
      v_product.unit,
      v_item.agreed_price_paise,
      0,                    -- no discount on SO conversion
      v_taxable,
      v_gst_rate,
      v_cgst,
      v_sgst,
      0,                    -- igst = 0 for intra-state
      v_item_total
    );

    -- ═════════════════════════════════════════════════════════════════════
    -- FIX #2: Race-safe inventory deduction (if stock-tracked)
    -- Same pattern as convert_po_to_bill: SELECT FOR UPDATE + subtransaction
    -- ═════════════════════════════════════════════════════════════════════
    IF v_product.is_stock_tracked THEN
      SELECT id, quantity_in_stock
      INTO v_inv_id, v_current_stock
      FROM inventory
      WHERE shop_id = v_shop_id
        AND product_id = v_item.product_id
        AND batch_number IS NULL
      FOR UPDATE;

      IF v_inv_id IS NULL THEN
        BEGIN
          INSERT INTO inventory (shop_id, product_id, quantity_in_stock)
          VALUES (v_shop_id, v_item.product_id, 0)
          RETURNING id, quantity_in_stock INTO v_inv_id, v_current_stock;
        EXCEPTION WHEN unique_violation THEN
          -- Lost race: another transaction created the row first.
          SELECT id, quantity_in_stock
          INTO v_inv_id, v_current_stock
          FROM inventory
          WHERE shop_id = v_shop_id
            AND product_id = v_item.product_id
            AND batch_number IS NULL
          FOR UPDATE;
        END;
      END IF;

      v_new_stock := v_current_stock - v_item.quantity;

      -- Soft-block: allow negative stock for POS (no exception raised)
      UPDATE inventory
      SET quantity_in_stock = v_new_stock,
          updated_at = now()
      WHERE id = v_inv_id;

      -- Audit trail
      INSERT INTO inventory_movements (
        shop_id, inventory_id, movement_type,
        quantity_change, quantity_after,
        reference_id, reference_type, reason
      ) VALUES (
        v_shop_id, v_inv_id, 'sale',
        -v_item.quantity, v_new_stock,
        v_invoice_id, 'invoice',
        'SO Fulfillment — Invoice ' || v_invoice_number
      );
    END IF;

    v_items_count := v_items_count + 1;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. UPDATE invoice header with real accumulated totals
  -- ═══════════════════════════════════════════════════════════════════════
  UPDATE invoices
  SET subtotal_paise    = v_subtotal,
      cgst_total_paise  = v_cgst_total,
      sgst_total_paise  = v_sgst_total,
      total_paise       = v_subtotal + v_cgst_total + v_sgst_total,
      updated_at        = now()
  WHERE id = v_invoice_id;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. KHATA ENGINE: auto-log credit for credit-mode invoices
  -- ═══════════════════════════════════════════════════════════════════════
  IF p_payment_mode = 'credit' AND v_customer_id IS NOT NULL
     AND (v_subtotal + v_cgst_total + v_sgst_total) > 0
  THEN
    INSERT INTO credit_ledger (
      id, shop_id, customer_id, invoice_id,
      amount_paise, transaction_type, notes
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      v_customer_id,
      v_invoice_id,
      v_subtotal + v_cgst_total + v_sgst_total,
      'credit_given',
      'SO Fulfillment — Invoice ' || v_invoice_number
    );

    UPDATE customers
    SET credit_balance_paise = credit_balance_paise + (v_subtotal + v_cgst_total + v_sgst_total)
    WHERE id = v_customer_id
      AND shop_id = v_shop_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. Update customer stats (if linked)
  -- ═══════════════════════════════════════════════════════════════════════
  IF v_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_spent_paise = total_spent_paise + (v_subtotal + v_cgst_total + v_sgst_total),
      visit_count = visit_count + 1,
      last_visit_at = now()
    WHERE id = v_customer_id
      AND shop_id = v_shop_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 7. Mark SO as fulfilled
  -- ═══════════════════════════════════════════════════════════════════════
  UPDATE sales_orders
  SET status = 'fulfilled',
      updated_at = now()
  WHERE id = p_so_id;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_paise', v_subtotal + v_cgst_total + v_sgst_total,
    'items_processed', v_items_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
