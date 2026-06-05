-- =========================================================================
-- Migration 032: ERP RPC Hardening
--
-- Goals:
--   1. Make SECURITY DEFINER tenant guards null-safe.
--   2. Restrict financial/stock RPC execution to authenticated users.
--   3. Move online order accept/reject into atomic RPCs.
--   4. Align SO conversion GST split with the TypeScript paise-math engine.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Shared guard: caller must be an active user for the target shop.
-- NULL-safe by construction; missing auth/user rows are rejected.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION assert_authenticated_shop(p_shop_id uuid)
RETURNS void AS $$
DECLARE
  v_caller_shop_id uuid;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  SELECT shop_id
  INTO v_caller_shop_id
  FROM public.users
  WHERE id = auth.uid()
    AND is_active = true;

  IF v_caller_shop_id IS NULL OR v_caller_shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', p_shop_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION assert_authenticated_shop(uuid) FROM PUBLIC;


-- -------------------------------------------------------------------------
-- Patch existing function bodies in-place so deployed DBs get the safer guard
-- without restating long historical RPC definitions.
-- -------------------------------------------------------------------------

DO $$
DECLARE
  v_def text;
  v_from_shop_guard_old text := $guard$
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) != v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;$guard$;
  v_from_shop_guard_distinct text := $guard$
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;$guard$;
  v_from_param_guard_old text := $guard$
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) != p_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', p_shop_id;
  END IF;$guard$;
  v_from_param_guard_distinct text := $guard$
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', p_shop_id;
  END IF;$guard$;
BEGIN
  -- save_invoice(jsonb, jsonb, jsonb)
  v_def := pg_get_functiondef('save_invoice(jsonb,jsonb,jsonb)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in save_invoice';
  END IF;
  EXECUTE v_def;

  -- save_purchase_bill(jsonb, jsonb)
  v_def := pg_get_functiondef('save_purchase_bill(jsonb,jsonb)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in save_purchase_bill';
  END IF;
  EXECUTE v_def;

  -- adjust_stock(uuid, uuid, numeric, text, text, uuid, text, boolean, bigint, uuid)
  v_def := pg_get_functiondef('adjust_stock(uuid,uuid,numeric,text,text,uuid,text,boolean,bigint,uuid)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_param_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_param_guard_old, E'\n  PERFORM assert_authenticated_shop(p_shop_id);');
  ELSIF position(v_from_param_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_param_guard_distinct, E'\n  PERFORM assert_authenticated_shop(p_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in adjust_stock';
  END IF;
  EXECUTE v_def;

  -- convert_po_to_bill(uuid, text, uuid)
  v_def := pg_get_functiondef('convert_po_to_bill(uuid,text,uuid)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in convert_po_to_bill';
  END IF;
  EXECUTE v_def;

  -- convert_so_to_invoice(uuid, text, uuid)
  v_def := pg_get_functiondef('convert_so_to_invoice(uuid,text,uuid)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in convert_so_to_invoice';
  END IF;

  IF position('v_total_gst' IN v_def) = 0
     AND position(E'  v_item_total     bigint;\n  v_items_count' IN v_def) > 0
  THEN
    v_def := replace(
      v_def,
      E'  v_item_total     bigint;\n  v_items_count',
      E'  v_item_total     bigint;\n  v_total_gst      bigint;\n  v_items_count'
    );
  END IF;

  IF position(E'    v_cgst := ROUND(v_taxable * v_gst_rate / 200.0)::bigint;   -- half GST\n    v_sgst := ROUND(v_taxable * v_gst_rate / 200.0)::bigint;   -- half GST' IN v_def) > 0 THEN
    v_def := replace(
      v_def,
      E'    v_cgst := ROUND(v_taxable * v_gst_rate / 200.0)::bigint;   -- half GST\n    v_sgst := ROUND(v_taxable * v_gst_rate / 200.0)::bigint;   -- half GST',
      E'    v_total_gst := ROUND(v_taxable * v_gst_rate / 100.0)::bigint;\n    v_cgst := ROUND(v_total_gst / 2.0)::bigint;\n    v_sgst := v_total_gst - v_cgst;'
    );
  ELSIF position(E'    v_total_gst := ROUND(v_taxable * v_gst_rate / 100.0)::bigint;\n    v_cgst := ROUND(v_total_gst / 2.0)::bigint;\n    v_sgst := v_total_gst - v_cgst;' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected GST split block not found in convert_so_to_invoice';
  END IF;
  EXECUTE v_def;

  -- create_sales_order(jsonb, jsonb)
  v_def := pg_get_functiondef('create_sales_order(jsonb,jsonb)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in create_sales_order';
  END IF;
  EXECUTE v_def;

  -- create_purchase_order(jsonb, jsonb)
  v_def := pg_get_functiondef('create_purchase_order(jsonb,jsonb)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_from_shop_guard_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_old, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSIF position(v_from_shop_guard_distinct IN v_def) > 0 THEN
    v_def := replace(v_def, v_from_shop_guard_distinct, E'\n  PERFORM assert_authenticated_shop(v_shop_id);');
  ELSE
    RAISE EXCEPTION 'Expected tenant guard not found in create_purchase_order';
  END IF;
  EXECUTE v_def;
END $$;


-- -------------------------------------------------------------------------
-- Atomic online order acceptance.
-- Finalizes a pending storefront invoice, deducts stock, and updates customer
-- stats in one transaction. WhatsApp remains a non-blocking app-side effect.
-- -------------------------------------------------------------------------

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

  SELECT id, shop_id, invoice_number, customer_id, total_paise, status
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

  UPDATE invoices
  SET status = 'completed',
      created_by = COALESCE(created_by, p_accepted_by, auth.uid()),
      updated_at = now()
  WHERE id = p_invoice_id;

  FOR v_item IN
    SELECT ii.product_id, ii.quantity, p.is_stock_tracked
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

  IF v_invoice.customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_spent_paise = total_spent_paise + v_invoice.total_paise,
        visit_count = visit_count + 1,
        last_visit_at = now(),
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


-- -------------------------------------------------------------------------
-- Atomic online order rejection.
-- Cancels only pending storefront invoices and reverses online khata exactly
-- once under the status lock.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reject_online_order(
  p_invoice_id uuid,
  p_shop_id uuid,
  p_rejected_by uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invoice record;
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

  UPDATE invoices
  SET status = 'cancelled',
      created_by = COALESCE(created_by, p_rejected_by, auth.uid()),
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_invoice.payment_mode = 'online_khata'
     AND v_invoice.customer_id IS NOT NULL
     AND v_invoice.total_paise > 0
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
    'status', 'cancelled'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- -------------------------------------------------------------------------
-- RPC execution grants.
-- SECURITY DEFINER functions should not be callable by anon/PUBLIC.
-- -------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION save_invoice(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION save_purchase_bill(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION adjust_stock(uuid, uuid, numeric, text, text, uuid, text, boolean, bigint, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION convert_po_to_bill(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION convert_so_to_invoice(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_sales_order(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_purchase_order(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION accept_online_order(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reject_online_order(uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION save_invoice(jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION save_purchase_bill(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_stock(uuid, uuid, numeric, text, text, uuid, text, boolean, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_po_to_bill(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_so_to_invoice(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_sales_order(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_purchase_order(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_online_order(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_online_order(uuid, uuid, uuid) TO authenticated;
