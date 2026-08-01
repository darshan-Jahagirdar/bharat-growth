-- =========================================================================
-- Staging characterization: invoice-sourced campaign matching
--
-- Run only after confirming supabase/.temp/project-ref is exactly
-- qokaaggeqahayxsybgds and migrations 001-051 are applied to that linked
-- staging project:
--
--   supabase db query --linked \
--     --file supabase/tests/051_campaign_approval_gate.sql
--
-- `--linked` makes the Supabase CLI use the repository's linked project rather
-- than a caller-supplied database URL. This harness creates only random
-- `wave-c-char-*` fixtures inside one transaction and rolls everything back.
-- Existing shops, including the durable staging fixture, are never selected,
-- updated, or deleted.
--
-- The exact invoice-path assertions are the pre-migration-052 baseline. These
-- assertions must remain unchanged and pass after find_campaign_matches is
-- generalized and visit-path assertions are added.
-- =========================================================================

BEGIN;

DO $wave_c_char$
DECLARE
  v_token              text := 'wave-c-char-' || gen_random_uuid()::text;
  v_guard_shop_id      uuid := gen_random_uuid();
  v_guard_tag_id       uuid := gen_random_uuid();
  v_guard_product_id   uuid := gen_random_uuid();
  v_guard_rule_id      uuid := gen_random_uuid();
  v_guard_alt_tag_id   uuid := gen_random_uuid();
  v_guard_alt_product_id uuid := gen_random_uuid();
  v_guard_alt_rule_id  uuid := gen_random_uuid();
  v_cap_shop_id        uuid := gen_random_uuid();
  v_cap_tag_id         uuid := gen_random_uuid();
  v_cap_product_id     uuid := gen_random_uuid();
  v_cap_rule_id        uuid := gen_random_uuid();
  v_today_ist          date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count              integer;
  v_distinct_count     integer;
  v_deleted_count      integer;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION
      'campaign characterization requires a privileged staging database role';
  END IF;

  CREATE TEMP TABLE wave_c_char_customers (
    scope             text NOT NULL,
    label             text NOT NULL,
    id                uuid PRIMARY KEY,
    marketing_consent boolean NOT NULL,
    UNIQUE (scope, label)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE wave_c_char_invoices (
    scope          text NOT NULL,
    label          text NOT NULL,
    id             uuid PRIMARY KEY,
    customer_label text NOT NULL,
    invoice_date   date NOT NULL,
    has_tagged_item boolean NOT NULL,
    UNIQUE (scope, label)
  ) ON COMMIT DROP;

  INSERT INTO public.shops (
    id,
    business_name,
    business_type,
    state_code,
    campaigns_approved,
    settings
  ) VALUES
    (
      v_guard_shop_id,
      v_token || '-guards',
      'general',
      '27',
      false,
      jsonb_build_object('fixture', v_token, 'scope', 'guards')
    ),
    (
      v_cap_shop_id,
      v_token || '-cap',
      'general',
      '27',
      true,
      jsonb_build_object('fixture', v_token, 'scope', 'cap')
    );

  INSERT INTO public.tags (id, shop_id, name) VALUES
    (v_guard_tag_id, v_guard_shop_id, v_token || '-guard-tag'),
    (v_guard_alt_tag_id, v_guard_shop_id, v_token || '-guard-alt-tag'),
    (v_cap_tag_id, v_cap_shop_id, v_token || '-cap-tag');

  INSERT INTO public.products (
    id,
    shop_id,
    name,
    hsn_code,
    gst_rate_percent,
    unit_price_paise,
    selling_price_paise,
    tag_id
  ) VALUES
    (
      v_guard_product_id,
      v_guard_shop_id,
      v_token || '-guard-product',
      '9999',
      0,
      10000,
      10000,
      v_guard_tag_id
    ),
    (
      v_cap_product_id,
      v_cap_shop_id,
      v_token || '-cap-product',
      '9999',
      0,
      10000,
      10000,
      v_cap_tag_id
    ),
    (
      v_guard_alt_product_id,
      v_guard_shop_id,
      v_token || '-guard-alt-product',
      '9999',
      0,
      10000,
      10000,
      v_guard_alt_tag_id
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
  ) VALUES
    (
      v_guard_rule_id,
      v_guard_shop_id,
      v_guard_tag_id,
      v_token || '-guard-rule',
      30,
      'PROMO',
      'Invoice characterization',
      true
    ),
    (
      v_cap_rule_id,
      v_cap_shop_id,
      v_cap_tag_id,
      v_token || '-cap-rule',
      30,
      'PROMO',
      'Daily cap characterization',
      true
    ),
    (
      v_guard_alt_rule_id,
      v_guard_shop_id,
      v_guard_alt_tag_id,
      v_token || '-guard-alt-rule',
      30,
      'RESTOCK',
      'Cross-rule characterization',
      true
    );

  INSERT INTO wave_c_char_customers (
    scope,
    label,
    id,
    marketing_consent
  ) VALUES
    ('guard', 'inside_mid', gen_random_uuid(), true),
    ('guard', 'grace_lower', gen_random_uuid(), true),
    ('guard', 'grace_upper', gen_random_uuid(), true),
    ('guard', 'too_old', gen_random_uuid(), true),
    ('guard', 'too_new', gen_random_uuid(), true),
    ('guard', 'consent_false', gen_random_uuid(), false),
    ('guard', 'dedupe', gen_random_uuid(), true),
    ('guard', 'cooldown_active', gen_random_uuid(), true),
    ('guard', 'cooldown_boundary', gen_random_uuid(), true),
    ('guard', 'one_per_run', gen_random_uuid(), true),
    ('cap', 'eligible_a', gen_random_uuid(), true),
    ('cap', 'eligible_b', gen_random_uuid(), true),
    ('cap', 'eligible_c', gen_random_uuid(), true),
    ('cap', 'quota_seed', gen_random_uuid(), true);

  INSERT INTO public.customers (
    id,
    shop_id,
    phone_number,
    name,
    dpdp_marketing_consent,
    consent_collected_at
  )
  SELECT
    c.id,
    CASE c.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    CASE c.scope
      WHEN 'guard' THEN 'WCG-'
      ELSE 'WCC-'
    END || left(replace(c.id::text, '-', ''), 10),
    v_token || '-' || c.scope || '-' || c.label,
    c.marketing_consent,
    CASE WHEN c.marketing_consent THEN now() ELSE NULL END
  FROM wave_c_char_customers c;

  INSERT INTO wave_c_char_invoices (
    scope,
    label,
    id,
    customer_label,
    invoice_date,
    has_tagged_item
  ) VALUES
    ('guard', 'inside_mid', gen_random_uuid(), 'inside_mid', v_today_ist - 31, true),
    ('guard', 'grace_lower', gen_random_uuid(), 'grace_lower', v_today_ist - 32, true),
    ('guard', 'grace_upper', gen_random_uuid(), 'grace_upper', v_today_ist - 30, true),
    ('guard', 'too_old', gen_random_uuid(), 'too_old', v_today_ist - 33, true),
    ('guard', 'too_new', gen_random_uuid(), 'too_new', v_today_ist - 29, true),
    ('guard', 'consent_false', gen_random_uuid(), 'consent_false', v_today_ist - 31, true),
    ('guard', 'dedupe', gen_random_uuid(), 'dedupe', v_today_ist - 31, true),
    (
      'guard',
      'cooldown_active_target',
      gen_random_uuid(),
      'cooldown_active',
      v_today_ist - 31,
      true
    ),
    (
      'guard',
      'cooldown_active_source',
      gen_random_uuid(),
      'cooldown_active',
      v_today_ist,
      false
    ),
    (
      'guard',
      'cooldown_boundary_target',
      gen_random_uuid(),
      'cooldown_boundary',
      v_today_ist - 31,
      true
    ),
    (
      'guard',
      'cooldown_boundary_source',
      gen_random_uuid(),
      'cooldown_boundary',
      v_today_ist,
      false
    ),
    ('guard', 'one_old', gen_random_uuid(), 'one_per_run', v_today_ist - 32, true),
    ('guard', 'one_new', gen_random_uuid(), 'one_per_run', v_today_ist - 30, true),
    ('cap', 'eligible_a', gen_random_uuid(), 'eligible_a', v_today_ist - 31, true),
    ('cap', 'eligible_b', gen_random_uuid(), 'eligible_b', v_today_ist - 31, true),
    ('cap', 'eligible_c', gen_random_uuid(), 'eligible_c', v_today_ist - 31, true),
    ('cap', 'quota_source', gen_random_uuid(), 'quota_seed', v_today_ist, false);

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
  )
  SELECT
    i.id,
    CASE i.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    upper(left(v_token, 28))
      || '-'
      || CASE i.scope WHEN 'guard' THEN 'G' ELSE 'C' END
      || '-'
      || lpad(
        row_number() OVER (
          PARTITION BY i.scope
          ORDER BY i.label
        )::text,
        2,
        '0'
      ),
    row_number() OVER (
      PARTITION BY i.scope
      ORDER BY i.label
    )::integer,
    public.get_financial_year(i.invoice_date),
    i.invoice_date,
    c.id,
    v_token || '-' || i.scope || '-' || c.label,
    CASE i.scope
      WHEN 'guard' THEN 'WCG-'
      ELSE 'WCC-'
    END || left(replace(c.id::text, '-', ''), 10),
    '27',
    10000,
    10000,
    'completed'
  FROM wave_c_char_invoices i
  JOIN wave_c_char_customers c
    ON c.scope = i.scope
   AND c.label = i.customer_label;

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
  )
  SELECT
    CASE i.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    i.id,
    CASE i.scope
      WHEN 'guard' THEN v_guard_product_id
      ELSE v_cap_product_id
    END,
    v_token || '-' || i.scope || '-product',
    '9999',
    1,
    'piece',
    10000,
    10000,
    0,
    10000
  FROM wave_c_char_invoices i
  WHERE i.has_tagged_item;

  UPDATE public.invoice_items ii
  SET product_id = v_guard_alt_product_id,
      product_name = v_token || '-guard-alt-product'
  FROM wave_c_char_invoices i
  WHERE i.id = ii.invoice_id
    AND i.scope = 'guard'
    AND i.label = 'one_old';

  -- Wave B approval gate: an otherwise eligible invoice must not match.
  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_guard_shop_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'unapproved guard shop returned % campaign match(es), expected 0',
      v_count;
  END IF;

  UPDATE public.shops
  SET campaigns_approved = true,
      campaigns_approved_at = now()
  WHERE id = v_guard_shop_id
    AND settings->>'fixture' = v_token;

  -- Old claims characterize dedupe and the exact 7-day cooldown boundary.
  INSERT INTO public.message_logs (
    shop_id,
    customer_id,
    invoice_id,
    rule_id,
    sent_at
  )
  SELECT
    CASE i.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    c.id,
    i.id,
    CASE i.scope
      WHEN 'guard' THEN v_guard_rule_id
      ELSE v_cap_rule_id
    END,
    CASE i.label
      WHEN 'dedupe' THEN now() - interval '8 days'
      WHEN 'cooldown_active_source' THEN now() - interval '6 days'
      WHEN 'cooldown_boundary_source' THEN now() - interval '7 days'
      WHEN 'quota_source' THEN now()
    END
  FROM wave_c_char_invoices i
  JOIN wave_c_char_customers c
    ON c.scope = i.scope
   AND c.label = i.customer_label
  WHERE i.label IN (
    'dedupe',
    'cooldown_active_source',
    'cooldown_boundary_source',
    'quota_source'
  );

  -- Exact approved invoice-path result set:
  --   * middle of the trigger window
  --   * both inclusive 2-day grace boundaries
  --   * exactly-7-days-old cooldown is allowed
  --   * newest qualifying invoice wins for one customer
  SELECT count(*), count(DISTINCT i.label)
  INTO v_count, v_distinct_count
  FROM public.find_campaign_matches(50) AS match
  JOIN wave_c_char_invoices i
    ON i.id = match.invoice_id
   AND i.scope = 'guard'
  JOIN wave_c_char_customers c
    ON c.scope = i.scope
   AND c.label = i.customer_label
  WHERE match.shop_id = v_guard_shop_id
    AND match.shop_name = v_token || '-guards'
    AND match.customer_id = c.id
    AND match.customer_name = v_token || '-guard-' || c.label
    AND match.customer_phone =
      'WCG-' || left(replace(c.id::text, '-', ''), 10)
    AND match.rule_id = v_guard_rule_id
    AND match.rule_name = v_token || '-guard-rule'
    AND match.tag_name = v_token || '-guard-tag'
    AND match.template_key = 'PROMO'
    AND match.custom_variable = 'Invoice characterization'
    AND i.label IN (
      'inside_mid',
      'grace_lower',
      'grace_upper',
      'cooldown_boundary_target',
      'one_new'
    );

  IF v_count <> 5 OR v_distinct_count <> 5 THEN
    RAISE EXCEPTION
      'expected five exact allowed invoice matches, got rows=% labels=%',
      v_count,
      v_distinct_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_guard_shop_id;

  IF v_count <> 5 THEN
    RAISE EXCEPTION
      'guard shop returned % total match(es), expected exact result set of 5',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(50) AS match
  JOIN wave_c_char_customers c
    ON c.id = match.customer_id
   AND c.scope = 'guard'
   AND c.label = 'one_per_run'
  JOIN wave_c_char_invoices i
    ON i.id = match.invoice_id
   AND i.label = 'one_new'
  WHERE match.shop_id = v_guard_shop_id
    AND match.rule_id = v_guard_rule_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'one-per-customer newest invoice assertion returned %, expected 1',
      v_count;
  END IF;

  -- Per-shop daily cap includes rows already logged since IST midnight.
  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(4) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'cap shop with one prior send and cap 4 returned %, expected 3',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(3) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'cap shop with one prior send and cap 3 returned %, expected 2',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(1) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'cap shop with one prior send and cap 1 returned %, expected 0',
      v_count;
  END IF;

  DELETE FROM public.shops
  WHERE id IN (v_guard_shop_id, v_cap_shop_id)
    AND settings->>'fixture' = v_token;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 2 THEN
    RAISE EXCEPTION
      'fixture cleanup deleted % shops, expected exactly 2',
      v_deleted_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shops
    WHERE id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.tags
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.products
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.customers
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.campaign_rules
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.invoices
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.invoice_items
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.message_logs
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
  ) THEN
    RAISE EXCEPTION 'fixture cleanup readback found residual rows';
  END IF;

  RAISE NOTICE
    'invoice campaign characterization passed: approval, window, grace, consent, dedupe, cooldown, one-per-run, cap, cleanup';
END;
$wave_c_char$;

ROLLBACK;
