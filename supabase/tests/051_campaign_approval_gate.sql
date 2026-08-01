-- =========================================================================
-- Staging verification: migration 051 campaign approval gate
--
-- Run only after confirming supabase/.temp/project-ref is exactly
-- qokaaggeqahayxsybgds and migration 051 is applied to that linked staging
-- project:
--
--   supabase db query --linked \
--     --file supabase/tests/051_campaign_approval_gate.sql
--
-- `--linked` makes the Supabase CLI use the repository's linked project rather
-- than a caller-supplied database URL. This harness creates only a random
-- `wave-b-051-*` fixture inside one transaction, verifies the unapproved and
-- approved RPC states, deletes that exact shop, verifies cascade cleanup, and
-- finally rolls back. Existing shops, including the durable staging fixture,
-- are never selected, updated, or deleted.
-- =========================================================================

BEGIN;

DO $wave_b_051$
DECLARE
  v_token             text := 'wave-b-051-' || gen_random_uuid()::text;
  v_shop_id           uuid := gen_random_uuid();
  v_tag_id            uuid := gen_random_uuid();
  v_product_id        uuid := gen_random_uuid();
  v_customer_id       uuid := gen_random_uuid();
  v_rule_id           uuid := gen_random_uuid();
  v_invoice_id        uuid := gen_random_uuid();
  v_invoice_date      date := (now() AT TIME ZONE 'Asia/Kolkata')::date - 30;
  v_unapproved_count  integer;
  v_approved_count    integer;
  v_deleted_count     integer;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION
      'migration 051 verification requires a privileged staging database role';
  END IF;

  INSERT INTO public.shops (
    id,
    business_name,
    business_type,
    state_code,
    settings
  ) VALUES (
    v_shop_id,
    v_token,
    'general',
    '27',
    jsonb_build_object('fixture', v_token)
  );

  IF (
    SELECT campaigns_approved
        OR campaigns_approved_at IS NOT NULL
        OR campaigns_approval_requested_at IS NOT NULL
    FROM public.shops
    WHERE id = v_shop_id
  ) THEN
    RAISE EXCEPTION 'migration 051 shop defaults are not false/null/null';
  END IF;

  INSERT INTO public.tags (id, shop_id, name)
  VALUES (v_tag_id, v_shop_id, v_token || '-tag');

  INSERT INTO public.products (
    id,
    shop_id,
    name,
    hsn_code,
    gst_rate_percent,
    unit_price_paise,
    selling_price_paise,
    tag_id
  ) VALUES (
    v_product_id,
    v_shop_id,
    v_token || '-product',
    '9999',
    0,
    10000,
    10000,
    v_tag_id
  );

  INSERT INTO public.customers (
    id,
    shop_id,
    phone_number,
    name,
    dpdp_marketing_consent,
    consent_collected_at
  ) VALUES (
    v_customer_id,
    v_shop_id,
    'WB051-' || left(replace(v_customer_id::text, '-', ''), 8),
    v_token || '-customer',
    true,
    now()
  );

  INSERT INTO public.campaign_rules (
    id,
    shop_id,
    tag_id,
    name,
    trigger_days,
    template_key,
    custom_variable,
    is_active
  ) VALUES (
    v_rule_id,
    v_shop_id,
    v_tag_id,
    v_token || '-rule',
    30,
    'PROMO',
    'Fixture only',
    true
  );

  INSERT INTO public.invoices (
    id,
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
    status
  ) VALUES (
    v_invoice_id,
    v_shop_id,
    upper(v_token),
    1,
    public.get_financial_year(v_invoice_date),
    v_invoice_date,
    v_customer_id,
    v_token || '-customer',
    'WB051-' || left(replace(v_customer_id::text, '-', ''), 8),
    '27',
    10000,
    10000,
    'completed'
  );

  INSERT INTO public.invoice_items (
    shop_id,
    invoice_id,
    product_id,
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
    v_product_id,
    v_token || '-product',
    '9999',
    1,
    'piece',
    10000,
    10000,
    0,
    10000
  );

  SELECT count(*)
  INTO v_unapproved_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_shop_id;

  IF v_unapproved_count <> 0 THEN
    RAISE EXCEPTION
      'unapproved fixture returned % campaign match(es), expected 0',
      v_unapproved_count;
  END IF;

  UPDATE public.shops
  SET campaigns_approved = true,
      campaigns_approved_at = now()
  WHERE id = v_shop_id
    AND settings->>'fixture' = v_token;

  SELECT count(*)
  INTO v_approved_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_shop_id
    AND match.customer_id = v_customer_id
    AND match.invoice_id = v_invoice_id
    AND match.rule_id = v_rule_id;

  IF v_approved_count <> 1 THEN
    RAISE EXCEPTION
      'approved fixture returned % exact campaign match(es), expected 1',
      v_approved_count;
  END IF;

  DELETE FROM public.shops
  WHERE id = v_shop_id
    AND business_name = v_token
    AND settings->>'fixture' = v_token;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION
      'fixture cleanup deleted % shops, expected exactly 1',
      v_deleted_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shops WHERE id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.tags WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.products WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.customers WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.campaign_rules WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.invoices WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.invoice_items WHERE shop_id = v_shop_id
  ) THEN
    RAISE EXCEPTION 'fixture cleanup readback found residual rows';
  END IF;

  RAISE NOTICE
    'migration 051 verified: unapproved=0, approved=1, cleanup=clean';
END;
$wave_b_051$;

ROLLBACK;
