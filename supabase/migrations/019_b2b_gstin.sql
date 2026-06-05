-- =========================================================================
-- Migration 019: B2B GSTIN Support
-- DB columns already exist: customers.gstin (varchar 15), invoices.customer_gstin (varchar 15)
-- This migration updates save_invoice to persist buyer GSTIN on the customer
-- record so it auto-fills on future invoices.
-- =========================================================================

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
BEGIN
  -- ── Extract shop_id and validate ──
  v_shop_id := (p_invoice->>'shop_id')::uuid;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  v_customer_id := (p_invoice->>'customer_id')::uuid;
  v_payment_mode := COALESCE(p_invoice->>'payment_mode', 'cash');
  v_total_paise := (p_invoice->>'total_paise')::bigint;

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

  -- ── 2. Insert all invoice items ──
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
      total_spent_paise = total_spent_paise + v_total_paise,
      visit_count = visit_count + 1,
      last_visit_at = now()
    WHERE id = (p_loyalty_entry->>'customer_id')::uuid
      AND shop_id = v_shop_id;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 4. KHATA (CREDIT) ENGINE
  -- ══════════════════════════════════════════════════════════════════════
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

  -- ══════════════════════════════════════════════════════════════════════
  -- 5. ATTRIBUTION LOOP
  -- ══════════════════════════════════════════════════════════════════════
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

  -- ══════════════════════════════════════════════════════════════════════
  -- 6. B2B GSTIN PERSISTENCE (Phase 21)
  -- Save/update buyer GSTIN on customer record so it auto-fills next time
  -- ══════════════════════════════════════════════════════════════════════
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

  -- ── Return the created invoice summary ──
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
