-- =========================================================================
-- Migration 033: Atomic online checkout RPC
-- Public storefront checkout must not trust browser-supplied prices, HSN, GST,
-- product names, or invoice sequence numbers.
-- =========================================================================

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
    payment_mode, status, delivery_address, notes
  ) VALUES (
    v_invoice_id, v_shop_id, v_invoice_number, v_next_seq, v_fy,
    v_invoice_date, 'regular',
    CASE WHEN v_shop.gst_type = 'composition' THEN 'bill_of_supply' ELSE 'tax_invoice' END,
    v_customer_id, v_customer_name, v_customer_phone,
    v_shop.state_code, false,
    v_subtotal, v_cgst_total, v_sgst_total, 0,
    0, 0, v_total,
    v_payment_mode, 'pending_online', v_delivery_address, 'Online order via storefront'
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
    'item_count', v_item_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Replaces migration 032's accept_online_order with an insufficient-stock guard.
CREATE OR REPLACE FUNCTION accept_online_order(
  p_invoice_id uuid,
  p_shop_id uuid,
  p_accepted_by uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invoice record;
  v_item record;
  v_inv_id uuid;
  v_current_stock numeric(10,3);
  v_new_stock numeric(10,3);
  v_items_count integer := 0;
BEGIN
  PERFORM assert_authenticated_shop(p_shop_id);

  SELECT id, shop_id, invoice_number, customer_id, total_paise, payment_mode, status
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Online order % not found', p_invoice_id;
  END IF;

  IF v_invoice.shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Online order % does not belong to shop %', p_invoice_id, p_shop_id;
  END IF;

  IF v_invoice.status IS DISTINCT FROM 'pending_online' THEN
    RAISE EXCEPTION 'Online order % is not pending (status=%)', p_invoice_id, v_invoice.status;
  END IF;

  FOR v_item IN
    SELECT ii.product_id, ii.product_name, ii.quantity, p.is_stock_tracked
    FROM invoice_items ii
    JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = p_invoice_id
      AND ii.shop_id = p_shop_id
      AND ii.product_id IS NOT NULL
  LOOP
    IF NOT COALESCE(v_item.is_stock_tracked, false) THEN
      CONTINUE;
    END IF;

    SELECT id, quantity_in_stock
    INTO v_inv_id, v_current_stock
    FROM inventory
    WHERE shop_id = p_shop_id
      AND product_id = v_item.product_id
      AND batch_number IS NULL
    FOR UPDATE;

    IF v_inv_id IS NULL THEN
      BEGIN
        INSERT INTO inventory (shop_id, product_id, quantity_in_stock)
        VALUES (p_shop_id, v_item.product_id, 0)
        RETURNING id, quantity_in_stock INTO v_inv_id, v_current_stock;
      EXCEPTION WHEN unique_violation THEN
        SELECT id, quantity_in_stock
        INTO v_inv_id, v_current_stock
        FROM inventory
        WHERE shop_id = p_shop_id
          AND product_id = v_item.product_id
          AND batch_number IS NULL
        FOR UPDATE;
      END;
    END IF;

    IF v_current_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %: required %, available %',
        v_item.product_name, v_item.quantity, v_current_stock;
    END IF;

    v_new_stock := v_current_stock - v_item.quantity;

    UPDATE inventory
    SET quantity_in_stock = v_new_stock,
        updated_at = now()
    WHERE id = v_inv_id;

    INSERT INTO inventory_movements (
      shop_id, inventory_id, movement_type,
      quantity_change, quantity_after,
      reference_id, reference_type, reason,
      created_by
    ) VALUES (
      p_shop_id, v_inv_id, 'sale',
      -v_item.quantity, v_new_stock,
      p_invoice_id, 'invoice',
      'Online order ' || v_invoice.invoice_number,
      COALESCE(p_accepted_by, auth.uid())
    );

    v_items_count := v_items_count + 1;
  END LOOP;

  UPDATE invoices
  SET status = 'completed',
      created_by = COALESCE(created_by, p_accepted_by, auth.uid()),
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_invoice.customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_spent_paise = total_spent_paise + v_invoice.total_paise,
        visit_count = visit_count + 1,
        last_visit_at = now(),
        updated_at = now()
    WHERE id = v_invoice.customer_id
      AND shop_id = p_shop_id;
  END IF;

  IF v_invoice.payment_mode = 'online_khata'
     AND v_invoice.customer_id IS NOT NULL
     AND v_invoice.total_paise > 0
     AND NOT EXISTS (
       SELECT 1
       FROM credit_ledger
       WHERE shop_id = p_shop_id
         AND invoice_id = p_invoice_id
         AND transaction_type = 'credit_given'
     )
  THEN
    INSERT INTO credit_ledger (
      shop_id, customer_id, invoice_id, amount_paise, transaction_type, notes
    ) VALUES (
      p_shop_id, v_invoice.customer_id, p_invoice_id, v_invoice.total_paise,
      'credit_given', 'Online order ' || v_invoice.invoice_number || ' (Khata)'
    );

    UPDATE customers
    SET credit_balance_paise = credit_balance_paise + v_invoice.total_paise,
        updated_at = now()
    WHERE id = v_invoice.customer_id
      AND shop_id = p_shop_id;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'total_paise', v_invoice.total_paise,
    'items_processed', v_items_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION reject_online_order(
  p_invoice_id uuid,
  p_shop_id uuid,
  p_rejected_by uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invoice record;
  v_has_credit boolean := false;
BEGIN
  PERFORM assert_authenticated_shop(p_shop_id);

  SELECT id, shop_id, invoice_number, customer_id, total_paise, payment_mode, status
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Online order % not found', p_invoice_id;
  END IF;

  IF v_invoice.shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Online order % does not belong to shop %', p_invoice_id, p_shop_id;
  END IF;

  IF v_invoice.status IS DISTINCT FROM 'pending_online' THEN
    RAISE EXCEPTION 'Online order % is not pending (status=%)', p_invoice_id, v_invoice.status;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM credit_ledger
    WHERE shop_id = p_shop_id
      AND invoice_id = p_invoice_id
      AND transaction_type = 'credit_given'
  ) INTO v_has_credit;

  UPDATE invoices
  SET status = 'cancelled',
      created_by = COALESCE(created_by, p_rejected_by, auth.uid()),
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_invoice.payment_mode = 'online_khata'
     AND v_invoice.customer_id IS NOT NULL
     AND v_invoice.total_paise > 0
     AND v_has_credit
  THEN
    INSERT INTO credit_ledger (
      shop_id, customer_id, invoice_id,
      amount_paise, transaction_type, notes
    ) VALUES (
      p_shop_id, v_invoice.customer_id, p_invoice_id,
      v_invoice.total_paise, 'payment_received',
      'Reversed: rejected online order ' || v_invoice.invoice_number
    );

    UPDATE customers
    SET credit_balance_paise = GREATEST(0, credit_balance_paise - v_invoice.total_paise),
        updated_at = now()
    WHERE id = v_invoice.customer_id
      AND shop_id = p_shop_id;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'status', 'cancelled',
    'credit_reversed', v_has_credit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_online_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_online_order(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION accept_online_order(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_online_order(uuid, uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION reject_online_order(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reject_online_order(uuid, uuid, uuid) TO authenticated;
