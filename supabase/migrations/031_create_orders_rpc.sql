-- =========================================================================
-- Migration 031: Order Creation RPCs (Phase 29.4)
--
-- Two SECURITY DEFINER functions for atomically creating orders with
-- gap-free sequence numbers:
--
--   1. create_sales_order   — Reserves items as a Sales Order
--   2. create_purchase_order — Creates a Purchase Order for a supplier
--
-- Both functions:
--   - Validate tenant ownership via auth.uid() → users.shop_id
--   - Call get_next_so_number / get_next_po_number (advisory-locked)
--   - Insert header + loop items in a single transaction
--   - DO NOT touch inventory (that only happens during conversion)
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. create_sales_order
--    POS Cart → Sales Order (status: 'reserved')
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_sales_order(
  p_order  jsonb,
  p_items  jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_shop_id       uuid;
  v_customer_id   uuid;
  v_total_paise   bigint;
  v_notes         text;
  v_created_by    uuid;
  v_so_number     text;
  v_so_id         uuid;
  v_item          jsonb;
  v_item_count    integer := 0;
BEGIN
  -- ── Extract order fields ──
  v_shop_id     := (p_order->>'shop_id')::uuid;
  v_customer_id := NULLIF(p_order->>'customer_id', '')::uuid;
  v_total_paise := COALESCE((p_order->>'total_amount_paise')::bigint, 0);
  v_notes       := p_order->>'notes';
  v_created_by  := NULLIF(p_order->>'created_by', '')::uuid;

  -- ── Validate inputs ──
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  -- ══ SECURITY GUARD: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- ── Generate gap-free SO number (advisory-locked) ──
  v_so_number := get_next_so_number(v_shop_id, CURRENT_DATE);
  v_so_id := gen_random_uuid();

  -- ── Extract sequence from generated number (e.g. 'SO/2025-26/00001' → 1) ──
  -- The sequence is the last segment after the final '/'
  DECLARE
    v_fy       varchar(7);
    v_seq      integer;
  BEGIN
    v_fy := get_financial_year(CURRENT_DATE);
    v_seq := LTRIM(split_part(v_so_number, '/', 3), '0')::integer;

    -- ── Insert SO header ──
    INSERT INTO sales_orders (
      id, shop_id, so_number, so_sequence, financial_year,
      customer_id, status, total_amount_paise, notes, created_by
    ) VALUES (
      v_so_id,
      v_shop_id,
      v_so_number,
      v_seq,
      v_fy,
      v_customer_id,
      'reserved',
      v_total_paise,
      v_notes,
      COALESCE(v_created_by, auth.uid())
    );
  END;

  -- ── Loop items and insert ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'product_id') IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO sales_order_items (
      shop_id, so_id, product_id, quantity, agreed_price_paise
    ) VALUES (
      v_shop_id,
      v_so_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'agreed_price_paise')::bigint, 0)
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'so_id', v_so_id,
    'so_number', v_so_number,
    'items_count', v_item_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. create_purchase_order
--    Speed Grid → Purchase Order (status: 'sent')
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_purchase_order(
  p_order  jsonb,
  p_items  jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_shop_id       uuid;
  v_supplier      text;
  v_expected_date date;
  v_total_paise   bigint;
  v_notes         text;
  v_created_by    uuid;
  v_po_number     text;
  v_po_id         uuid;
  v_item          jsonb;
  v_item_count    integer := 0;
BEGIN
  -- ── Extract order fields ──
  v_shop_id       := (p_order->>'shop_id')::uuid;
  v_supplier      := p_order->>'supplier_name';
  v_expected_date := NULLIF(p_order->>'expected_date', '')::date;
  v_total_paise   := COALESCE((p_order->>'total_amount_paise')::bigint, 0);
  v_notes         := p_order->>'notes';
  v_created_by    := NULLIF(p_order->>'created_by', '')::uuid;

  -- ── Validate inputs ──
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  IF v_supplier IS NULL OR v_supplier = '' THEN
    RAISE EXCEPTION 'supplier_name is required';
  END IF;

  -- ══ SECURITY GUARD: Verify caller belongs to this shop ══
  IF (SELECT shop_id FROM public.users WHERE id = auth.uid() AND is_active = true) IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', v_shop_id;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- ── Generate gap-free PO number (advisory-locked) ──
  v_po_number := get_next_po_number(v_shop_id, CURRENT_DATE);
  v_po_id := gen_random_uuid();

  -- ── Extract sequence from generated number (e.g. 'PO/2025-26/00001' → 1) ──
  DECLARE
    v_fy       varchar(7);
    v_seq      integer;
  BEGIN
    v_fy := get_financial_year(CURRENT_DATE);
    v_seq := LTRIM(split_part(v_po_number, '/', 3), '0')::integer;

    -- ── Insert PO header ──
    INSERT INTO purchase_orders (
      id, shop_id, po_number, po_sequence, financial_year,
      supplier_name, status, expected_date, total_amount_paise, notes, created_by
    ) VALUES (
      v_po_id,
      v_shop_id,
      v_po_number,
      v_seq,
      v_fy,
      v_supplier,
      'sent',
      v_expected_date,
      v_total_paise,
      v_notes,
      COALESCE(v_created_by, auth.uid())
    );
  END;

  -- ── Loop items and insert ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'product_id') IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO purchase_order_items (
      shop_id, po_id, product_id, quantity, expected_price_paise
    ) VALUES (
      v_shop_id,
      v_po_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'expected_price_paise')::bigint, 0)
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'po_id', v_po_id,
    'po_number', v_po_number,
    'items_count', v_item_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
