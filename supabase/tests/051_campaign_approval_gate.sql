-- =========================================================================
-- Staging characterization: invoice-sourced campaign matching
--
-- Run only after confirming supabase/.temp/project-ref is exactly
-- qokaaggeqahayxsybgds. The invoice-only block was committed and captured
-- against migrations 001-051 before any Wave C schema change. The full
-- invoice + visit + RPC harness now requires migrations 001-052:
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

DO $wave_c_visit$
DECLARE
  v_token                text := 'wave-c-visit-' || gen_random_uuid()::text;
  v_guard_shop_id        uuid := gen_random_uuid();
  v_guard_tag_id         uuid := gen_random_uuid();
  v_guard_alt_tag_id     uuid := gen_random_uuid();
  v_guard_product_id     uuid := gen_random_uuid();
  v_guard_rule_id        uuid := gen_random_uuid();
  v_guard_alt_rule_id    uuid := gen_random_uuid();
  v_cap_shop_id          uuid := gen_random_uuid();
  v_cap_tag_id           uuid := gen_random_uuid();
  v_cap_product_id       uuid := gen_random_uuid();
  v_cap_rule_id          uuid := gen_random_uuid();
  v_cross_invoice_id     uuid := gen_random_uuid();
  v_cap_invoice_id       uuid := gen_random_uuid();
  v_today_ist            date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count                integer;
  v_invoice_count        integer;
  v_visit_count          integer;
  v_distinct_count       integer;
  v_deleted_count        integer;
  v_neither_rejected     boolean := false;
  v_both_rejected        boolean := false;
  v_visit_dupe_rejected  boolean := false;
  v_invoice_dupe_rejected boolean := false;
BEGIN
  IF to_regclass('public.customer_visits') IS NULL THEN
    RAISE EXCEPTION
      'visit characterization requires migration 052 on linked staging';
  END IF;

  CREATE TEMP TABLE wave_c_visit_customers (
    scope             text NOT NULL,
    label             text NOT NULL,
    id                uuid PRIMARY KEY,
    marketing_consent boolean NOT NULL,
    UNIQUE (scope, label)
  ) ON COMMIT DROP;

  CREATE TEMP TABLE wave_c_visit_events (
    scope          text NOT NULL,
    label          text NOT NULL,
    id             uuid PRIMARY KEY,
    customer_label text NOT NULL,
    visit_date     date NOT NULL,
    tag_kind       text,
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
      'Visit characterization',
      true
    ),
    (
      v_guard_alt_rule_id,
      v_guard_shop_id,
      v_guard_alt_tag_id,
      v_token || '-guard-alt-rule',
      30,
      'RESTOCK',
      'Cross-rule visit characterization',
      true
    ),
    (
      v_cap_rule_id,
      v_cap_shop_id,
      v_cap_tag_id,
      v_token || '-cap-rule',
      30,
      'PROMO',
      'Mixed-source cap characterization',
      true
    );

  INSERT INTO wave_c_visit_customers (
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
    ('guard', 'cross_source', gen_random_uuid(), true),
    ('cap', 'invoice', gen_random_uuid(), true),
    ('cap', 'visit_a', gen_random_uuid(), true),
    ('cap', 'visit_b', gen_random_uuid(), true),
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
      WHEN 'guard' THEN 'WVG-'
      ELSE 'WVC-'
    END || left(replace(c.id::text, '-', ''), 10),
    v_token || '-' || c.scope || '-' || c.label,
    c.marketing_consent,
    CASE WHEN c.marketing_consent THEN now() END
  FROM wave_c_visit_customers c;

  INSERT INTO wave_c_visit_events (
    scope,
    label,
    id,
    customer_label,
    visit_date,
    tag_kind
  ) VALUES
    ('guard', 'inside_mid', gen_random_uuid(), 'inside_mid', v_today_ist - 31, 'base'),
    ('guard', 'grace_lower', gen_random_uuid(), 'grace_lower', v_today_ist - 32, 'base'),
    ('guard', 'grace_upper', gen_random_uuid(), 'grace_upper', v_today_ist - 30, 'base'),
    ('guard', 'too_old', gen_random_uuid(), 'too_old', v_today_ist - 33, 'base'),
    ('guard', 'too_new', gen_random_uuid(), 'too_new', v_today_ist - 29, 'base'),
    ('guard', 'consent_false', gen_random_uuid(), 'consent_false', v_today_ist - 31, 'base'),
    ('guard', 'dedupe', gen_random_uuid(), 'dedupe', v_today_ist - 31, 'base'),
    (
      'guard',
      'cooldown_active_target',
      gen_random_uuid(),
      'cooldown_active',
      v_today_ist - 31,
      'base'
    ),
    (
      'guard',
      'cooldown_active_source',
      gen_random_uuid(),
      'cooldown_active',
      v_today_ist,
      NULL
    ),
    (
      'guard',
      'cooldown_boundary_target',
      gen_random_uuid(),
      'cooldown_boundary',
      v_today_ist - 31,
      'base'
    ),
    (
      'guard',
      'cooldown_boundary_source',
      gen_random_uuid(),
      'cooldown_boundary',
      v_today_ist,
      NULL
    ),
    ('guard', 'one_old', gen_random_uuid(), 'one_per_run', v_today_ist - 32, 'alt'),
    ('guard', 'one_new', gen_random_uuid(), 'one_per_run', v_today_ist - 30, 'base'),
    ('guard', 'cross_visit', gen_random_uuid(), 'cross_source', v_today_ist - 31, 'base'),
    ('cap', 'visit_a', gen_random_uuid(), 'visit_a', v_today_ist - 31, 'base'),
    ('cap', 'visit_b', gen_random_uuid(), 'visit_b', v_today_ist - 31, 'base'),
    ('cap', 'quota_source', gen_random_uuid(), 'quota_seed', v_today_ist, NULL);

  INSERT INTO public.customer_visits (
    id,
    shop_id,
    customer_id,
    tag_id,
    visit_date
  )
  SELECT
    v.id,
    CASE v.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    c.id,
    CASE
      WHEN v.tag_kind = 'base' AND v.scope = 'guard' THEN v_guard_tag_id
      WHEN v.tag_kind = 'alt' THEN v_guard_alt_tag_id
      WHEN v.tag_kind = 'base' AND v.scope = 'cap' THEN v_cap_tag_id
      ELSE NULL
    END,
    v.visit_date
  FROM wave_c_visit_events v
  JOIN wave_c_visit_customers c
    ON c.scope = v.scope
   AND c.label = v.customer_label;

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
  ) VALUES
    (
      v_cross_invoice_id,
      v_guard_shop_id,
      upper(left(v_token, 30)) || '-GX',
      1,
      public.get_financial_year(v_today_ist - 31),
      v_today_ist - 31,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'cross_source'
      ),
      v_token || '-guard-cross_source',
      (
        SELECT 'WVG-' || left(replace(id::text, '-', ''), 10)
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'cross_source'
      ),
      '27',
      10000,
      10000,
      'completed'
    ),
    (
      v_cap_invoice_id,
      v_cap_shop_id,
      upper(left(v_token, 30)) || '-CI',
      1,
      public.get_financial_year(v_today_ist - 31),
      v_today_ist - 31,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'cap' AND label = 'invoice'
      ),
      v_token || '-cap-invoice',
      (
        SELECT 'WVC-' || left(replace(id::text, '-', ''), 10)
        FROM wave_c_visit_customers
        WHERE scope = 'cap' AND label = 'invoice'
      ),
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
  ) VALUES
    (
      v_guard_shop_id,
      v_cross_invoice_id,
      v_guard_product_id,
      v_token || '-guard-product',
      '9999',
      1,
      'piece',
      10000,
      10000,
      0,
      10000
    ),
    (
      v_cap_shop_id,
      v_cap_invoice_id,
      v_cap_product_id,
      v_token || '-cap-product',
      '9999',
      1,
      'piece',
      10000,
      10000,
      0,
      10000
    );

  -- Wave B approval gate applies equally to visit and invoice candidates.
  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_guard_shop_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'unapproved visit guard shop returned % campaign match(es), expected 0',
      v_count;
  END IF;

  UPDATE public.shops
  SET campaigns_approved = true,
      campaigns_approved_at = now()
  WHERE id = v_guard_shop_id
    AND settings->>'fixture' = v_token;

  INSERT INTO public.message_logs (
    shop_id,
    customer_id,
    invoice_id,
    visit_id,
    rule_id,
    sent_at
  )
  SELECT
    CASE v.scope
      WHEN 'guard' THEN v_guard_shop_id
      ELSE v_cap_shop_id
    END,
    c.id,
    NULL,
    v.id,
    CASE v.scope
      WHEN 'guard' THEN v_guard_rule_id
      ELSE v_cap_rule_id
    END,
    CASE v.label
      WHEN 'dedupe' THEN now() - interval '8 days'
      WHEN 'cooldown_active_source' THEN now() - interval '6 days'
      WHEN 'cooldown_boundary_source' THEN now() - interval '7 days'
      WHEN 'quota_source' THEN now()
    END
  FROM wave_c_visit_events v
  JOIN wave_c_visit_customers c
    ON c.scope = v.scope
   AND c.label = v.customer_label
  WHERE v.label IN (
    'dedupe',
    'cooldown_active_source',
    'cooldown_boundary_source',
    'quota_source'
  );

  -- Exact visit-path result set with every legacy return field checked.
  SELECT count(*), count(DISTINCT v.label)
  INTO v_count, v_distinct_count
  FROM public.find_campaign_matches(50) AS match
  JOIN wave_c_visit_events v
    ON v.id = match.visit_id
   AND v.scope = 'guard'
  JOIN wave_c_visit_customers c
    ON c.scope = v.scope
   AND c.label = v.customer_label
  WHERE match.shop_id = v_guard_shop_id
    AND match.shop_name = v_token || '-guards'
    AND match.customer_id = c.id
    AND match.customer_name = v_token || '-guard-' || c.label
    AND match.customer_phone =
      'WVG-' || left(replace(c.id::text, '-', ''), 10)
    AND match.invoice_id IS NULL
    AND match.rule_id = v_guard_rule_id
    AND match.rule_name = v_token || '-guard-rule'
    AND match.tag_name = v_token || '-guard-tag'
    AND match.template_key = 'PROMO'
    AND match.custom_variable = 'Visit characterization'
    AND v.label IN (
      'inside_mid',
      'grace_lower',
      'grace_upper',
      'cooldown_boundary_target',
      'one_new'
    );

  IF v_count <> 5 OR v_distinct_count <> 5 THEN
    RAISE EXCEPTION
      'expected five exact allowed visit matches, got rows=% labels=%',
      v_count,
      v_distinct_count;
  END IF;

  -- Same-day invoice/visit tie for one customer must preserve billed behavior.
  SELECT
    count(*),
    count(*) FILTER (
      WHERE match.invoice_id = v_cross_invoice_id
        AND match.visit_id IS NULL
    )
  INTO v_count, v_invoice_count
  FROM public.find_campaign_matches(50) AS match
  JOIN wave_c_visit_customers c
    ON c.id = match.customer_id
   AND c.scope = 'guard'
   AND c.label = 'cross_source'
  WHERE match.shop_id = v_guard_shop_id;

  IF v_count <> 1 OR v_invoice_count <> 1 THEN
    RAISE EXCEPTION
      'cross-source same-day invoice preference returned rows=% invoices=%',
      v_count,
      v_invoice_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_guard_shop_id;

  IF v_count <> 6 THEN
    RAISE EXCEPTION
      'visit guard shop returned % total match(es), expected exact result set of 6',
      v_count;
  END IF;

  -- Cap shop has one prior send plus one invoice and two visit candidates.
  SELECT
    count(*),
    count(*) FILTER (WHERE match.invoice_id IS NOT NULL),
    count(*) FILTER (WHERE match.visit_id IS NOT NULL)
  INTO v_count, v_invoice_count, v_visit_count
  FROM public.find_campaign_matches(50) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 3 OR v_invoice_count <> 1 OR v_visit_count <> 2 THEN
    RAISE EXCEPTION
      'mixed-source uncapped result rows=% invoices=% visits=%, expected 3/1/2',
      v_count,
      v_invoice_count,
      v_visit_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(4) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'mixed-source shop with one prior send and cap 4 returned %, expected 3',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(3) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'mixed-source shop with one prior send and cap 3 returned %, expected 2',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.find_campaign_matches(1) AS match
  WHERE match.shop_id = v_cap_shop_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'mixed-source shop with one prior send and cap 1 returned %, expected 0',
      v_count;
  END IF;

  BEGIN
    INSERT INTO public.message_logs (
      shop_id,
      customer_id,
      invoice_id,
      visit_id,
      rule_id
    ) VALUES (
      v_guard_shop_id,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'cross_source'
      ),
      NULL,
      NULL,
      v_guard_rule_id
    );
  EXCEPTION
    WHEN check_violation THEN
      v_neither_rejected := true;
  END;

  BEGIN
    INSERT INTO public.message_logs (
      shop_id,
      customer_id,
      invoice_id,
      visit_id,
      rule_id
    ) VALUES (
      v_guard_shop_id,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'cross_source'
      ),
      v_cross_invoice_id,
      (
        SELECT id
        FROM wave_c_visit_events
        WHERE scope = 'guard' AND label = 'cross_visit'
      ),
      v_guard_rule_id
    );
  EXCEPTION
    WHEN check_violation THEN
      v_both_rejected := true;
  END;

  BEGIN
    INSERT INTO public.message_logs (
      shop_id,
      customer_id,
      invoice_id,
      visit_id,
      rule_id
    ) VALUES (
      v_guard_shop_id,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'dedupe'
      ),
      NULL,
      (
        SELECT id
        FROM wave_c_visit_events
        WHERE scope = 'guard' AND label = 'dedupe'
      ),
      v_guard_rule_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_visit_dupe_rejected := true;
  END;

  INSERT INTO public.message_logs (
    shop_id,
    customer_id,
    invoice_id,
    visit_id,
    rule_id
  ) VALUES (
    v_guard_shop_id,
    (
      SELECT id
      FROM wave_c_visit_customers
      WHERE scope = 'guard' AND label = 'cross_source'
    ),
    v_cross_invoice_id,
    NULL,
    v_guard_rule_id
  );

  BEGIN
    INSERT INTO public.message_logs (
      shop_id,
      customer_id,
      invoice_id,
      visit_id,
      rule_id
    ) VALUES (
      v_guard_shop_id,
      (
        SELECT id
        FROM wave_c_visit_customers
        WHERE scope = 'guard' AND label = 'cross_source'
      ),
      v_cross_invoice_id,
      NULL,
      v_guard_rule_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_invoice_dupe_rejected := true;
  END;

  IF NOT v_neither_rejected
     OR NOT v_both_rejected
     OR NOT v_visit_dupe_rejected
     OR NOT v_invoice_dupe_rejected THEN
    RAISE EXCEPTION
      'source constraints failed: neither=% both=% visit_dupe=% invoice_dupe=%',
      v_neither_rejected,
      v_both_rejected,
      v_visit_dupe_rejected,
      v_invoice_dupe_rejected;
  END IF;

  DELETE FROM public.shops
  WHERE id IN (v_guard_shop_id, v_cap_shop_id)
    AND settings->>'fixture' = v_token;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 2 THEN
    RAISE EXCEPTION
      'visit fixture cleanup deleted % shops, expected exactly 2',
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
    FROM public.customer_visits
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
    UNION ALL
    SELECT 1
    FROM public.message_logs
    WHERE shop_id IN (v_guard_shop_id, v_cap_shop_id)
  ) THEN
    RAISE EXCEPTION 'visit fixture cleanup readback found residual rows';
  END IF;

  RAISE NOTICE
    'visit campaign characterization passed: approval, window, grace, consent, dedupe, cooldown, cross-source one-per-run, mixed cap, cleanup';
END;
$wave_c_visit$;

DO $wave_c_visit_rpc$
DECLARE
  v_token             text := 'wave-c-rpc-' || gen_random_uuid()::text;
  v_shop_id           uuid := gen_random_uuid();
  v_other_shop_id     uuid := gen_random_uuid();
  v_user_id           uuid := gen_random_uuid();
  v_tag_id            uuid := gen_random_uuid();
  v_latest_rule_id    uuid := gen_random_uuid();
  v_boundary_rule_id  uuid := gen_random_uuid();
  v_expired_rule_id   uuid := gen_random_uuid();
  v_customer_id       uuid;
  v_first_visit_id    uuid;
  v_second_visit_id   uuid;
  v_third_visit_id    uuid;
  v_latest_log_id     uuid := gen_random_uuid();
  v_boundary_log_id   uuid := gen_random_uuid();
  v_expired_log_id    uuid := gen_random_uuid();
  v_result            jsonb;
  v_stats             jsonb;
  v_today_ist         date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count             integer;
  v_points_sum        integer;
  v_rejected          boolean := false;
  v_tenant_rejected   boolean := false;
BEGIN
  INSERT INTO public.shops (
    id,
    business_name,
    business_type,
    state_code,
    settings
  ) VALUES (
    v_shop_id,
    v_token || '-shop',
    'general',
    '27',
    jsonb_build_object('fixture', v_token, 'scope', 'rpc')
  );

  INSERT INTO public.shops (
    id,
    business_name,
    business_type,
    state_code,
    settings
  ) VALUES (
    v_other_shop_id,
    v_token || '-other-shop',
    'general',
    '27',
    jsonb_build_object('fixture', v_token, 'scope', 'rpc-other')
  );

  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'authenticated',
    'authenticated',
    v_token || '@example.invalid',
    now(),
    now()
  );

  INSERT INTO public.users (
    id,
    shop_id,
    full_name,
    role,
    is_active
  ) VALUES (
    v_user_id,
    v_shop_id,
    v_token || '-owner',
    'owner',
    true
  );

  INSERT INTO public.tags (id, shop_id, name)
  VALUES (v_tag_id, v_shop_id, v_token || '-tag');

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
      v_latest_rule_id,
      v_shop_id,
      v_tag_id,
      v_token || '-latest-rule',
      30,
      'PROMO',
      'Latest attribution characterization',
      true
    ),
    (
      v_boundary_rule_id,
      v_shop_id,
      v_tag_id,
      v_token || '-boundary-rule',
      30,
      'PROMO',
      'Boundary attribution characterization',
      true
    ),
    (
      v_expired_rule_id,
      v_shop_id,
      v_tag_id,
      v_token || '-expired-rule',
      30,
      'PROMO',
      'Expired attribution characterization',
      true
    );

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    PERFORM public.log_customer_visit(
      v_other_shop_id,
      '9876543210',
      NULL,
      NULL,
      false
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'Unauthorized: user does not belong to shop %' THEN
        v_tenant_rejected := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF NOT v_tenant_rejected THEN
    RAISE EXCEPTION 'cross-tenant visit RPC call was not rejected';
  END IF;

  v_result := public.log_customer_visit(
    v_shop_id,
    '98765 43210',
    'Original Visit Customer',
    v_tag_id,
    false
  );
  v_customer_id := (v_result->>'customer_id')::uuid;
  v_first_visit_id := (v_result->>'visit_id')::uuid;

  IF (v_result->>'points_awarded')::integer <> 1
     OR (v_result->>'loyalty_balance')::integer <> 1 THEN
    RAISE EXCEPTION
      'first visit loyalty result was %, expected one point and balance one',
      v_result;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.consent_logs
  WHERE shop_id = v_shop_id
    AND customer_id = v_customer_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'false marketing consent created % consent log(s), expected 0',
      v_count;
  END IF;

  INSERT INTO public.message_logs (
    id,
    shop_id,
    customer_id,
    invoice_id,
    visit_id,
    rule_id,
    sent_at
  ) VALUES
    (
      v_expired_log_id,
      v_shop_id,
      v_customer_id,
      NULL,
      v_first_visit_id,
      v_expired_rule_id,
      now() - interval '14 days' - interval '1 second'
    ),
    (
      v_boundary_log_id,
      v_shop_id,
      v_customer_id,
      NULL,
      v_first_visit_id,
      v_boundary_rule_id,
      now() - interval '14 days'
    ),
    (
      v_latest_log_id,
      v_shop_id,
      v_customer_id,
      NULL,
      v_first_visit_id,
      v_latest_rule_id,
      now() - interval '1 day'
    );

  v_result := public.log_customer_visit(
    v_shop_id,
    '+91-98765-43210',
    'Replacement Name Must Not Win',
    v_tag_id,
    true
  );
  v_second_visit_id := (v_result->>'visit_id')::uuid;

  IF (v_result->>'customer_id')::uuid IS DISTINCT FROM v_customer_id
     OR v_second_visit_id = v_first_visit_id
     OR (v_result->>'points_awarded')::integer <> 1
     OR (v_result->>'loyalty_balance')::integer <> 2 THEN
    RAISE EXCEPTION
      'second normalized visit did not reuse customer and award flat point: %',
      v_result;
  END IF;

  v_result := public.log_customer_visit(
    v_shop_id,
    '919876543210',
    NULL,
    NULL,
    false
  );
  v_third_visit_id := (v_result->>'visit_id')::uuid;

  IF (v_result->>'customer_id')::uuid IS DISTINCT FROM v_customer_id
     OR v_third_visit_id IN (v_first_visit_id, v_second_visit_id)
     OR (v_result->>'points_awarded')::integer <> 1
     OR (v_result->>'loyalty_balance')::integer <> 3 THEN
    RAISE EXCEPTION
      'third visit did not preserve customer/consent and flat balance: %',
      v_result;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.shop_id = v_shop_id
    AND c.phone_number = '+919876543210'
    AND c.name = 'Original Visit Customer'
    AND c.visit_count = 3
    AND c.last_visit_at IS NOT NULL
    AND c.total_spent_paise = 0
    AND c.dpdp_marketing_consent = true;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'visit customer identity/counters/consent/no-spend assertion failed';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.customer_visits
  WHERE shop_id = v_shop_id
    AND customer_id = v_customer_id
    AND visit_date = v_today_ist
    AND (
      (id IN (v_first_visit_id, v_second_visit_id) AND tag_id = v_tag_id)
      OR (id = v_third_visit_id AND tag_id IS NULL)
    );

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'visit RPC inserted % visits, expected 3', v_count;
  END IF;

  SELECT count(*), COALESCE(sum(points), 0)
  INTO v_count, v_points_sum
  FROM public.loyalty_ledger
  WHERE shop_id = v_shop_id
    AND customer_id = v_customer_id
    AND invoice_id IS NULL
    AND entry_type = 'earn'
    AND points = 1;

  IF v_count <> 3 OR v_points_sum <> 3 THEN
    RAISE EXCEPTION
      'visit RPC loyalty rows=% points=%, expected 3/3',
      v_count,
      v_points_sum;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.consent_logs
  WHERE shop_id = v_shop_id
    AND customer_id = v_customer_id
    AND purpose = 'whatsapp_marketing'
    AND status = 'granted'
    AND consent_method = 'verbal_recorded'
    AND collected_by = v_user_id
    AND metadata->>'source' = 'customer_visit'
    AND (metadata->>'visit_id')::uuid = v_second_visit_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'affirmative-only append consent assertion returned %, expected 1',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.consent_logs
  WHERE shop_id = v_shop_id
    AND customer_id = v_customer_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'consent log total was %, expected exactly one affirmative grant',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.message_logs
  WHERE id = v_latest_log_id
    AND converted_at IS NOT NULL
    AND conversion_invoice_id IS NULL
    AND conversion_visit_id = v_second_visit_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'latest visit attribution assertion returned %, expected 1',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.message_logs
  WHERE id = v_boundary_log_id
    AND converted_at IS NOT NULL
    AND conversion_invoice_id IS NULL
    AND conversion_visit_id = v_third_visit_id;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'exact 14-day visit attribution assertion returned %, expected 1',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.message_logs
  WHERE id = v_expired_log_id
    AND converted_at IS NULL
    AND conversion_invoice_id IS NULL
    AND conversion_visit_id IS NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'expired visit attribution assertion returned %, expected 1',
      v_count;
  END IF;

  v_stats := public.get_retention_stats(
    v_shop_id,
    now() - interval '30 days',
    now() + interval '1 second'
  );

  IF (v_stats->>'messages_sent')::integer <> 3
     OR (v_stats->>'customers_returned')::integer <> 1
     OR (v_stats->>'revenue_attributed_paise')::bigint <> 0 THEN
    RAISE EXCEPTION
      'visit retention stats were %, expected sent=3 returned=1 revenue=0',
      v_stats;
  END IF;

  BEGIN
    PERFORM public.log_customer_visit(
      v_shop_id,
      '9876543210',
      NULL,
      gen_random_uuid(),
      false
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'Tag % does not belong to shop %' THEN
        v_rejected := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'foreign or missing visit tag was not rejected';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.customer_visits
  WHERE shop_id = v_shop_id;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'rejected visit RPC left side effects; visits=%, expected 3',
      v_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.invoice_items WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.inventory WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.inventory_movements WHERE shop_id = v_shop_id
  ) THEN
    RAISE EXCEPTION
      'visit RPC created forbidden invoice, line-item, or inventory effects';
  END IF;

  DELETE FROM public.shops
  WHERE id IN (v_shop_id, v_other_shop_id)
    AND settings->>'fixture' = v_token;

  DELETE FROM auth.users
  WHERE id = v_user_id
    AND email = v_token || '@example.invalid';

  IF EXISTS (
    SELECT 1
    FROM public.shops
    WHERE id IN (v_shop_id, v_other_shop_id)
    UNION ALL
    SELECT 1 FROM public.customer_visits WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.loyalty_ledger WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM public.message_logs WHERE shop_id = v_shop_id
    UNION ALL
    SELECT 1 FROM auth.users WHERE id = v_user_id
  ) THEN
    RAISE EXCEPTION 'visit RPC fixture cleanup readback found residual rows';
  END IF;

  RAISE NOTICE
    'visit RPC characterization passed: tenant, identity, consent, flat loyalty, no spend/stock, attribution, rollback cleanup';
END;
$wave_c_visit_rpc$;

ROLLBACK;
