-- =========================================================================
-- Migration 022: save_invoice V2 — Atomic Inventory Deduction
-- Moves stock deduction from sequential frontend RPC calls into the
-- save_invoice transaction itself. For every invoice item whose product
-- has is_stock_tracked = true, we:
--   1. UPSERT the inventory row (subtract qty, auto-create if missing)
--   2. Insert an audit trail row into inventory_movements
-- Soft-block: negative stock is ALLOWED (POS offline-tolerant).
-- =========================================================================

CREATE OR REPLACE FUNCTION save_invoice(
  p_invoice       jsonb,
  p_items         jsonb,    -- array of invoice items
  p_loyalty_entry jsonb DEFAULT NULL  -- optional loyalty points entry
)
RETURNS jsonb AS $$
DECLARE
  v_invoice_id     uuid;
  v_shop_id        uuid;
  v_fy             varchar(7);
  v_next_seq       integer;
  v_invoice_number text;
  v_item           jsonb;
  v_result         jsonb;
  -- Inventory deduction variables
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

  -- ── Generate sequential invoice number (with advisory lock) ──
  v_fy := get_financial_year((p_invoice->>'invoice_date')::date);

  PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || v_fy));

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = v_shop_id AND financial_year = v_fy;

  v_invoice_number := 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
  v_invoice_id := gen_random_uuid();

  -- ── 1. Insert invoice ──
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
    (p_invoice->>'customer_id')::uuid,
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
    (p_invoice->>'total_paise')::bigint,
    COALESCE(p_invoice->>'payment_mode', 'cash'),
    p_invoice->>'payment_reference',
    'completed',
    (p_invoice->>'created_by')::uuid
  );

  -- ── 2. Insert all invoice items + deduct inventory atomically ──
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

    -- ── Phase 26 V2: Atomic inventory deduction for tracked products ──
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    SELECT is_stock_tracked INTO v_is_tracked
    FROM products
    WHERE id = v_product_id;

    IF v_is_tracked THEN
      -- Find or auto-create inventory row (UPSERT pattern)
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
        -v_qty, v_new_stock,
        v_invoice_id, 'invoice',
        'POS Invoice ' || v_invoice_number
      );
    END IF;
  END LOOP;

  -- ── 3. Insert loyalty entry (if provided) ──
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

    -- Update customer denormalized fields
    UPDATE customers SET
      total_spent_paise = total_spent_paise + (p_invoice->>'total_paise')::bigint,
      visit_count = visit_count + 1,
      last_visit_at = now()
    WHERE id = (p_loyalty_entry->>'customer_id')::uuid
      AND shop_id = v_shop_id;
  END IF;

  -- ── Return the created invoice summary ──
  v_result := jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'invoice_sequence', v_next_seq,
    'financial_year', v_fy,
    'total_paise', (p_invoice->>'total_paise')::bigint
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
