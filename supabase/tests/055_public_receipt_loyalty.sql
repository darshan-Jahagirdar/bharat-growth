-- =========================================================================
-- Migration 055 rollback-backed receipt-loyalty and grant-boundary harness
--
-- Run only against linked staging qokaaggeqahayxsybgds after migration 055:
--   supabase db query --linked --file supabase/tests/055_public_receipt_loyalty.sql
-- =========================================================================

BEGIN;

DO $$
DECLARE
  v_token text := 'receipt-loyalty-055-' || gen_random_uuid()::text;
  v_shop_id uuid;
  v_customer_id uuid;
  v_invoice_id uuid;
  v_walkin_invoice_id uuid;
  v_receipt jsonb;
  v_table text;
  v_revoked_tables constant text[] := ARRAY[
    'campaign_rules',
    'consent_logs',
    'credit_ledger',
    'customers',
    'inventory_movements',
    'loyalty_ledger',
    'message_logs',
    'purchase_bills',
    'purchase_order_items',
    'purchase_orders',
    'sales_order_items',
    'sales_orders',
    'tags'
  ];
BEGIN
  INSERT INTO public.shops (
    business_name,
    business_type,
    state_code,
    settings
  ) VALUES (
    v_token,
    'general',
    '27',
    jsonb_build_object('fixture', v_token)
  )
  RETURNING id INTO v_shop_id;

  INSERT INTO public.customers (
    shop_id,
    phone_number,
    name,
    dpdp_data_consent
  ) VALUES (
    v_shop_id,
    '+910000000001',
    v_token || '-customer',
    true
  )
  RETURNING id INTO v_customer_id;

  -- Historical balance before this invoice. The trigger ignores the supplied
  -- running_balance and stores 17 from the locked ledger SUM.
  INSERT INTO public.loyalty_ledger (
    shop_id,
    customer_id,
    entry_type,
    points,
    running_balance,
    description
  ) VALUES (
    v_shop_id,
    v_customer_id,
    'adjust',
    17,
    999,
    v_token || '-opening'
  );

  INSERT INTO public.invoices (
    shop_id,
    invoice_number,
    invoice_sequence,
    financial_year,
    invoice_date,
    customer_id,
    customer_name,
    customer_phone,
    billing_state_code,
    subtotal_paise,
    total_paise,
    payment_mode,
    status
  ) VALUES (
    v_shop_id,
    v_token || '-invoice',
    1,
    '2026-27',
    CURRENT_DATE,
    v_customer_id,
    v_token || '-customer',
    '+910000000001',
    '27',
    20000,
    20000,
    'credit',
    'completed'
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (
    shop_id,
    invoice_id,
    product_name,
    hsn_code,
    quantity,
    unit,
    unit_price_paise,
    taxable_amount_paise,
    gst_rate_percent,
    total_paise
  ) VALUES (
    v_shop_id,
    v_invoice_id,
    v_token || '-item',
    '00000000',
    1,
    'piece',
    20000,
    20000,
    0,
    20000
  );

  -- This is the exact row the public receipt must expose: two points earned,
  -- historical balance 19. The database trigger owns the balance value.
  INSERT INTO public.loyalty_ledger (
    shop_id,
    customer_id,
    invoice_id,
    entry_type,
    points,
    running_balance,
    description
  ) VALUES (
    v_shop_id,
    v_customer_id,
    v_invoice_id,
    'earn',
    2,
    -999,
    v_token || '-invoice-earn'
  );

  -- A later entry proves the receipt returns the historical post-invoice
  -- balance, not the customer's current balance at receipt-read time.
  INSERT INTO public.loyalty_ledger (
    shop_id,
    customer_id,
    entry_type,
    points,
    running_balance,
    description
  ) VALUES (
    v_shop_id,
    v_customer_id,
    'adjust',
    3,
    -999,
    v_token || '-later'
  );

  SELECT public.get_public_receipt(v_invoice_id)
  INTO v_receipt;

  IF (v_receipt->>'points_earned')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION
      'receipt points_earned mismatch: expected 2, got %',
      v_receipt->'points_earned';
  END IF;

  IF (v_receipt->>'points_balance')::integer IS DISTINCT FROM 19 THEN
    RAISE EXCEPTION
      'receipt points_balance mismatch: expected historical 19, got %',
      v_receipt->'points_balance';
  END IF;

  IF v_receipt ? 'customer_id' THEN
    RAISE EXCEPTION 'receipt unexpectedly exposed customer_id';
  END IF;

  INSERT INTO public.invoices (
    shop_id,
    invoice_number,
    invoice_sequence,
    financial_year,
    invoice_date,
    customer_id,
    billing_state_code,
    subtotal_paise,
    total_paise,
    payment_mode,
    status
  ) VALUES (
    v_shop_id,
    v_token || '-walkin',
    2,
    '2026-27',
    CURRENT_DATE,
    NULL,
    '27',
    10000,
    10000,
    'cash',
    'completed'
  )
  RETURNING id INTO v_walkin_invoice_id;

  SELECT public.get_public_receipt(v_walkin_invoice_id)
  INTO v_receipt;

  IF v_receipt->>'points_earned' IS NOT NULL
     OR v_receipt->>'points_balance' IS NOT NULL THEN
    RAISE EXCEPTION
      'walk-in receipt loyalty must be null: earned %, balance %',
      v_receipt->'points_earned',
      v_receipt->'points_balance';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    'public.get_public_receipt(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon lost get_public_receipt execute privilege';
  END IF;

  FOREACH v_table IN ARRAY v_revoked_tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants grant_row
      WHERE grant_row.table_schema = 'public'
        AND grant_row.table_name = v_table
        AND grant_row.grantee = 'anon'
    ) THEN
      RAISE EXCEPTION 'anon still has table privilege on public.%', v_table;
    END IF;

    IF has_any_column_privilege(
      'anon',
      format('public.%I', v_table),
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'anon still has column SELECT on public.%', v_table;
    END IF;
  END LOOP;
END $$;

ROLLBACK;
