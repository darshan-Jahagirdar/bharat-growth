-- =========================================================================
-- Migration 034: Storefront checkout idempotency
--
-- Public storefront checkout is hit by untrusted browsers. A rapid double-
-- click, an automatic retry after a lost response, or a refresh-resubmit must
-- NOT create duplicate pending_online orders.
--
-- Approach (additive, backward-compatible):
--   1. invoices.idempotency_key column + partial-unique index per shop.
--   2. create_online_order accepts an optional idempotency_key. When present,
--      it serializes same-key requests with an advisory lock, returns the
--      already-created order if one exists, and otherwise stores the key on
--      the new invoice. Omitting the key preserves the old behavior.
-- =========================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS idempotency_key text;

-- One stored order per (shop, key). NULL keys are unconstrained so legacy /
-- POS invoices are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_shop_idempotency_key_uidx
  ON invoices (shop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


CREATE OR REPLACE FUNCTION create_online_order(p_order jsonb)
RETURNS jsonb AS $$
DECLARE
  v_shop_id uuid;
  v_shop record;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_delivery_address text;
  v_payment_method text;
  v_payment_mode text;
  v_data_consent boolean;
  v_idempotency_key text;
  v_existing record;
  v_items jsonb;
  v_item jsonb;
  v_line jsonb;
  v_line_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_product record;
  v_qty numeric(10,3);
  v_stock numeric(10,3);
  v_taxable bigint;
  v_total_gst bigint;
  v_cgst bigint;
  v_sgst bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_cgst_total bigint := 0;
  v_sgst_total bigint := 0;
  v_total bigint := 0;
  v_item_count integer := 0;
  v_invoice_id uuid := gen_random_uuid();
  v_invoice_date date := CURRENT_DATE;
  v_fy varchar(7);
  v_next_seq integer;
  v_invoice_number text;
  v_ip inet;
  v_user_agent text;
BEGIN
  v_shop_id := (p_order->>'shop_id')::uuid;
  v_customer_name := NULLIF(left(trim(COALESCE(p_order->>'customer_name', '')), 120), '');
  v_customer_phone := regexp_replace(COALESCE(p_order->>'customer_phone', ''), '[^0-9]', '', 'g');
  v_delivery_address := NULLIF(left(trim(COALESCE(p_order->>'delivery_address', '')), 500), '');
  v_payment_method := p_order->>'payment_method';
  v_data_consent := COALESCE((p_order->>'data_consent')::boolean, false);
  v_idempotency_key := NULLIF(left(trim(COALESCE(p_order->>'idempotency_key', '')), 64), '');
  v_items := p_order->'items';
  v_user_agent := NULLIF(left(COALESCE(p_order->>'user_agent', ''), 500), '');

  IF NULLIF(COALESCE(p_order->>'ip_address', ''), '') IS NOT NULL THEN
    v_ip := (p_order->>'ip_address')::inet;
  END IF;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  IF v_customer_name IS NULL THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;

  IF v_customer_phone !~ '^[0-9]{10,15}$' THEN
    RAISE EXCEPTION 'A valid customer_phone is required';
  END IF;

  IF NOT v_data_consent THEN
    RAISE EXCEPTION 'Explicit data consent is required for checkout';
  END IF;

  IF v_payment_method NOT IN ('upi', 'khata') THEN
    RAISE EXCEPTION 'payment_method must be upi or khata';
  END IF;

  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_items) = 0
     OR jsonb_array_length(v_items) > 100
  THEN
    RAISE EXCEPTION 'items must contain 1 to 100 products';
  END IF;

  SELECT id, gst_type, state_code
  INTO v_shop
  FROM shops
  WHERE id = v_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  -- Idempotency short-circuit -----------------------------------------------
  -- Serialize concurrent same-key requests, then return the order this key
  -- already created (if any) instead of creating a duplicate.
  IF v_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || ':' || v_idempotency_key));

    SELECT i.id, i.invoice_number, i.total_paise,
           (SELECT count(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS item_count
    INTO v_existing
    FROM invoices i
    WHERE i.shop_id = v_shop_id
      AND i.idempotency_key = v_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing.id,
        'invoice_number', v_existing.invoice_number,
        'total_paise', v_existing.total_paise,
        'item_count', v_existing.item_count,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_payment_mode := CASE
    WHEN v_payment_method = 'khata' THEN 'online_khata'
    ELSE 'online_upi'
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 9999999.999 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;

    SELECT
      id, name, hsn_code, unit, selling_price_paise,
      CASE WHEN v_shop.gst_type = 'composition' THEN 0 ELSE gst_rate_percent END AS gst_rate_percent,
      COALESCE(is_stock_tracked, false) AS is_stock_tracked
    INTO v_product
    FROM products
    WHERE id = v_product_id
      AND shop_id = v_shop_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is not available for this shop', v_product_id;
    END IF;

    IF v_product.is_stock_tracked THEN
      v_stock := 0;
      SELECT quantity_in_stock
      INTO v_stock
      FROM inventory
      WHERE shop_id = v_shop_id
        AND product_id = v_product_id
        AND batch_number IS NULL;

      IF NOT FOUND THEN
        v_stock := 0;
      END IF;

      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %: requested %, available %',
          v_product.name, v_qty, v_stock;
      END IF;
    END IF;

    v_taxable := ROUND(v_qty * v_product.selling_price_paise)::bigint;
    v_total_gst := ROUND(v_taxable * v_product.gst_rate_percent / 100.0)::bigint;
    v_cgst := ROUND(v_total_gst / 2.0)::bigint;
    v_sgst := v_total_gst - v_cgst;
    v_line_total := v_taxable + v_cgst + v_sgst;

    v_subtotal := v_subtotal + v_taxable;
    v_cgst_total := v_cgst_total + v_cgst;
    v_sgst_total := v_sgst_total + v_sgst;
    v_total := v_total + v_line_total;
    v_item_count := v_item_count + 1;

    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'hsn_code', v_product.hsn_code,
      'quantity', v_qty,
      'unit', v_product.unit,
      'unit_price_paise', v_product.selling_price_paise,
      'taxable_amount_paise', v_taxable,
      'gst_rate_percent', v_product.gst_rate_percent,
      'cgst_paise', v_cgst,
      'sgst_paise', v_sgst,
      'total_paise', v_line_total
    ));
  END LOOP;

  INSERT INTO customers (
    shop_id, phone_number, name, address, segment,
    total_spent_paise, visit_count, credit_balance_paise,
    dpdp_data_consent, consent_collected_at
  ) VALUES (
    v_shop_id, v_customer_phone, v_customer_name, v_delivery_address, 'new',
    0, 0, 0,
    true, now()
  )
  ON CONFLICT (shop_id, phone_number) DO UPDATE
  SET name = CASE
        WHEN customers.name IS NULL OR btrim(customers.name) = '' THEN EXCLUDED.name
        ELSE customers.name
      END,
      address = CASE
        WHEN customers.address IS NULL OR btrim(customers.address) = '' THEN EXCLUDED.address
        ELSE customers.address
      END,
      dpdp_data_consent = true,
      consent_collected_at = now(),
      updated_at = now()
  RETURNING id INTO v_customer_id;

  INSERT INTO consent_logs (
    shop_id, customer_id, purpose, status, consent_method,
    ip_address, user_agent, metadata
  ) VALUES (
    v_shop_id, v_customer_id, 'data_collection', 'granted', 'in_app',
    v_ip, v_user_agent,
    jsonb_build_object('source', 'storefront_checkout', 'order_channel', 'online_storefront')
  );

  v_fy := get_financial_year(v_invoice_date);
  PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || v_fy));

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = v_shop_id
    AND financial_year = v_fy;

  v_invoice_number := 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');

  INSERT INTO invoices (
    id, shop_id, invoice_number, invoice_sequence, financial_year,
    invoice_date, invoice_type, document_type,
    customer_id, customer_name, customer_phone,
    billing_state_code, is_inter_state,
    subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
    discount_paise, round_off_paise, total_paise,
    payment_mode, status, delivery_address, notes, idempotency_key
  ) VALUES (
    v_invoice_id, v_shop_id, v_invoice_number, v_next_seq, v_fy,
    v_invoice_date, 'regular',
    CASE WHEN v_shop.gst_type = 'composition' THEN 'bill_of_supply' ELSE 'tax_invoice' END,
    v_customer_id, v_customer_name, v_customer_phone,
    v_shop.state_code, false,
    v_subtotal, v_cgst_total, v_sgst_total, 0,
    0, 0, v_total,
    v_payment_mode, 'pending_online', v_delivery_address, 'Online order via storefront',
    v_idempotency_key
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    INSERT INTO invoice_items (
      shop_id, invoice_id, product_id, product_name, hsn_code,
      quantity, unit, unit_price_paise, discount_paise,
      taxable_amount_paise, gst_rate_percent,
      cgst_paise, sgst_paise, igst_paise, total_paise
    ) VALUES (
      v_shop_id, v_invoice_id,
      (v_line->>'product_id')::uuid,
      v_line->>'product_name',
      v_line->>'hsn_code',
      (v_line->>'quantity')::numeric,
      v_line->>'unit',
      (v_line->>'unit_price_paise')::bigint,
      0,
      (v_line->>'taxable_amount_paise')::bigint,
      (v_line->>'gst_rate_percent')::smallint,
      (v_line->>'cgst_paise')::bigint,
      (v_line->>'sgst_paise')::bigint,
      0,
      (v_line->>'total_paise')::bigint
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_paise', v_total,
    'item_count', v_item_count,
    'idempotent_replay', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_online_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_online_order(jsonb) TO service_role;
