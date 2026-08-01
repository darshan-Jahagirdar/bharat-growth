-- =========================================================================
-- Migration 052: customer visit log + attribution generalisation
--
-- A visit records only customer identity and one optional interest tag. It
-- deliberately has no amount, price, line items, or inventory effect.
--
-- Writes are RPC-only and append-only for authenticated shop users. This
-- prevents a direct customer_visits insert from bypassing the transactional
-- customer, loyalty, consent, and attribution side effects.
--
-- message_logs source rows enforce invoice XOR visit. Conversion destinations
-- deliberately do not enforce XOR: save_invoice remains unchanged, so a rare
-- concurrent invoice/visit return can populate both conversion references on
-- one log. Retention stats still count that customer once and include revenue
-- only when the conversion invoice is completed. Making that race loud would
-- risk failing a real invoice save, which is worse than the redundant
-- attribution references.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Append-only visit ledger
-- -------------------------------------------------------------------------

CREATE TABLE public.customer_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id      uuid REFERENCES public.tags(id) ON DELETE SET NULL,
  visit_date  date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_visits_shop_date
  ON public.customer_visits (shop_id, visit_date);

CREATE INDEX idx_customer_visits_customer
  ON public.customer_visits (customer_id);

CREATE INDEX idx_customer_visits_tag
  ON public.customer_visits (tag_id);

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_visits FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_visits_select ON public.customer_visits
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()));

REVOKE ALL ON TABLE public.customer_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_visits TO authenticated;
GRANT ALL ON TABLE public.customer_visits TO service_role;

-- -------------------------------------------------------------------------
-- 2. Generalise message source + conversion destination
-- -------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.message_logs
    WHERE invoice_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'migration 052 preflight failed: existing message_logs rows without invoice_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.message_logs'::regclass
      AND conname = 'message_logs_invoice_id_rule_id_key'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION
      'migration 052 preflight failed: expected message_logs invoice/rule unique constraint is missing';
  END IF;
END;
$preflight$;

ALTER TABLE public.message_logs
  DROP CONSTRAINT message_logs_invoice_id_rule_id_key;

DROP INDEX public.idx_message_logs_invoice_rule;

ALTER TABLE public.message_logs
  ALTER COLUMN invoice_id DROP NOT NULL,
  ADD COLUMN visit_id uuid
    REFERENCES public.customer_visits(id) ON DELETE CASCADE,
  ADD COLUMN conversion_visit_id uuid
    REFERENCES public.customer_visits(id) ON DELETE SET NULL,
  ADD CONSTRAINT message_logs_one_source CHECK (
    (invoice_id IS NOT NULL AND visit_id IS NULL)
    OR (invoice_id IS NULL AND visit_id IS NOT NULL)
  );

CREATE UNIQUE INDEX message_logs_invoice_rule_unique
  ON public.message_logs (invoice_id, rule_id)
  WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX message_logs_visit_rule_unique
  ON public.message_logs (visit_id, rule_id)
  WHERE visit_id IS NOT NULL;

CREATE INDEX idx_message_logs_conversion_visit
  ON public.message_logs (conversion_visit_id)
  WHERE conversion_visit_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. Match invoice and visit campaign sources through one global guard set
-- -------------------------------------------------------------------------

DROP FUNCTION public.find_campaign_matches(integer);

CREATE FUNCTION public.find_campaign_matches(p_daily_cap integer DEFAULT 50)
RETURNS TABLE (
  shop_id         uuid,
  shop_name       text,
  customer_id     uuid,
  customer_name   text,
  customer_phone  text,
  invoice_id      uuid,
  visit_id        uuid,
  rule_id         uuid,
  rule_name       text,
  tag_name        text,
  template_key    text,
  custom_variable text
) AS $$
  WITH params AS (
    SELECT
      (now() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
      (((now() AT TIME ZONE 'Asia/Kolkata')::date)::timestamp AT TIME ZONE 'Asia/Kolkata') AS ist_midnight
  ),
  sent_today AS (
    SELECT ml.shop_id, count(*) AS cnt
    FROM message_logs ml
    CROSS JOIN params p
    WHERE ml.sent_at >= p.ist_midnight
    GROUP BY ml.shop_id
  ),
  invoice_candidates AS (
    SELECT
      cr.shop_id,
      s.business_name AS shop_name,
      c.id            AS customer_id,
      c.name          AS customer_name,
      c.phone_number  AS customer_phone,
      i.id            AS invoice_id,
      NULL::uuid      AS visit_id,
      cr.id           AS rule_id,
      cr.name         AS rule_name,
      t.name          AS tag_name,
      cr.template_key,
      cr.custom_variable,
      i.invoice_date  AS event_date,
      0               AS source_priority,
      i.id            AS source_id
    FROM campaign_rules cr
    CROSS JOIN params p
    JOIN tags t   ON t.id = cr.tag_id
    JOIN shops s  ON s.id = cr.shop_id
     AND s.campaigns_approved = true
    JOIN invoices i
      ON i.shop_id = cr.shop_id
     AND i.status = 'completed'
     AND i.customer_id IS NOT NULL
     AND i.invoice_date BETWEEN p.today_ist - cr.trigger_days - 2
                            AND p.today_ist - cr.trigger_days
    JOIN customers c
      ON c.id = i.customer_id
     AND c.shop_id = cr.shop_id
     AND c.dpdp_marketing_consent = true
     AND c.phone_number IS NOT NULL
     AND c.phone_number NOT LIKE 'ERASED-%'
    WHERE cr.is_active = true
      -- invoice must contain at least one product carrying the rule's tag
      AND EXISTS (
        SELECT 1
        FROM invoice_items ii
        JOIN products pr ON pr.id = ii.product_id
        WHERE ii.invoice_id = i.id
          AND pr.tag_id = cr.tag_id
      )
      -- dedupe: never message the same (invoice, rule) twice
      AND NOT EXISTS (
        SELECT 1 FROM message_logs ml
        WHERE ml.invoice_id = i.id
          AND ml.rule_id = cr.id
      )
      -- 7-day per-customer cooldown across all rules
      AND NOT EXISTS (
        SELECT 1 FROM message_logs ml2
        WHERE ml2.customer_id = c.id
          AND ml2.sent_at > now() - interval '7 days'
      )
  ),
  visit_candidates AS (
    SELECT
      cr.shop_id,
      s.business_name AS shop_name,
      c.id            AS customer_id,
      c.name          AS customer_name,
      c.phone_number  AS customer_phone,
      NULL::uuid      AS invoice_id,
      cv.id           AS visit_id,
      cr.id           AS rule_id,
      cr.name         AS rule_name,
      t.name          AS tag_name,
      cr.template_key,
      cr.custom_variable,
      cv.visit_date   AS event_date,
      1               AS source_priority,
      cv.id           AS source_id
    FROM campaign_rules cr
    CROSS JOIN params p
    JOIN tags t   ON t.id = cr.tag_id
    JOIN shops s  ON s.id = cr.shop_id
     AND s.campaigns_approved = true
    JOIN customer_visits cv
      ON cv.shop_id = cr.shop_id
     AND cv.tag_id = cr.tag_id
     AND cv.visit_date BETWEEN p.today_ist - cr.trigger_days - 2
                           AND p.today_ist - cr.trigger_days
    JOIN customers c
      ON c.id = cv.customer_id
     AND c.shop_id = cr.shop_id
     AND c.dpdp_marketing_consent = true
     AND c.phone_number IS NOT NULL
     AND c.phone_number NOT LIKE 'ERASED-%'
    WHERE cr.is_active = true
      -- dedupe: never message the same (visit, rule) twice
      AND NOT EXISTS (
        SELECT 1 FROM message_logs ml
        WHERE ml.visit_id = cv.id
          AND ml.rule_id = cr.id
      )
      -- 7-day per-customer cooldown across all rules and both sources
      AND NOT EXISTS (
        SELECT 1 FROM message_logs ml2
        WHERE ml2.customer_id = c.id
          AND ml2.sent_at > now() - interval '7 days'
      )
  ),
  combined_candidates AS (
    SELECT * FROM invoice_candidates
    UNION ALL
    SELECT * FROM visit_candidates
  ),
  ranked AS (
    SELECT
      cc.*,
      -- one message per customer per run across invoices and visits.
      -- Prefer a billed invoice on same-day ties, then UUIDs for stability.
      row_number() OVER (
        PARTITION BY cc.shop_id, cc.customer_id
        ORDER BY
          cc.event_date DESC,
          cc.source_priority,
          cc.source_id,
          cc.rule_id
      ) AS customer_rank
    FROM combined_candidates cc
  ),
  capped AS (
    SELECT
      ranked.*,
      -- source_id preserves the prior invoice-only UUID cap ordering.
      row_number() OVER (
        PARTITION BY ranked.shop_id
        ORDER BY ranked.source_id, ranked.source_priority, ranked.rule_id
      ) AS shop_rank,
      COALESCE(st.cnt, 0) AS already_sent_today
    FROM ranked
    LEFT JOIN sent_today st ON st.shop_id = ranked.shop_id
    WHERE ranked.customer_rank = 1
  )
  SELECT
    shop_id, shop_name, customer_id, customer_name, customer_phone,
    invoice_id, visit_id, rule_id, rule_name, tag_name, template_key,
    custom_variable
  FROM capped
  WHERE shop_rank + already_sent_today <= p_daily_cap;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.find_campaign_matches(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_campaign_matches(integer)
  TO service_role;

-- -------------------------------------------------------------------------
-- 4. Tenant-scoped transactional visit capture
-- -------------------------------------------------------------------------

CREATE FUNCTION public.log_customer_visit(
  p_shop_id           uuid,
  p_phone_number      text,
  p_customer_name     text DEFAULT NULL,
  p_tag_id            uuid DEFAULT NULL,
  p_marketing_consent boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_digits          text;
  v_last10          text;
  v_phone_number    text;
  v_customer_name   text;
  v_customer_id     uuid;
  v_visit_id        uuid;
  v_loyalty_balance integer;
  v_points_awarded  constant integer := 1;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  PERFORM public.assert_authenticated_shop(p_shop_id);

  v_digits := regexp_replace(
    COALESCE(p_phone_number, ''),
    '\D',
    '',
    'g'
  );

  IF length(v_digits) = 12 AND left(v_digits, 2) = '91' THEN
    v_last10 := right(v_digits, 10);
  ELSIF length(v_digits) = 10 THEN
    v_last10 := v_digits;
  ELSE
    RAISE EXCEPTION 'A valid 10-digit Indian mobile number is required';
  END IF;

  IF v_last10 !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'A valid 10-digit Indian mobile number is required';
  END IF;

  v_phone_number := '+91' || v_last10;
  v_customer_name := NULLIF(btrim(p_customer_name), '');

  IF p_tag_id IS NOT NULL THEN
    PERFORM 1
    FROM public.tags
    WHERE id = p_tag_id
      AND shop_id = p_shop_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tag % does not belong to shop %', p_tag_id, p_shop_id;
    END IF;
  END IF;

  -- Serialize RPC callers for one shop/phone identity, including first create.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_shop_id::text || ':' || v_last10 || ':customer-visit')
  );

  SELECT c.id
  INTO v_customer_id
  FROM public.customers c
  WHERE c.shop_id = p_shop_id
    AND c.phone_number NOT LIKE 'ERASED-%'
    AND right(regexp_replace(c.phone_number, '\D', '', 'g'), 10) = v_last10
  ORDER BY
    (c.phone_number = v_phone_number) DESC,
    c.created_at,
    c.id
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      shop_id,
      phone_number,
      name,
      segment,
      total_spent_paise,
      visit_count,
      last_visit_at,
      dpdp_marketing_consent,
      consent_collected_at
    ) VALUES (
      p_shop_id,
      v_phone_number,
      v_customer_name,
      'new',
      0,
      1,
      now(),
      COALESCE(p_marketing_consent, false),
      CASE WHEN COALESCE(p_marketing_consent, false) THEN now() END
    )
    ON CONFLICT (shop_id, phone_number) DO UPDATE
    SET name = CASE
          WHEN public.customers.name IS NULL
            OR btrim(public.customers.name) = ''
          THEN EXCLUDED.name
          ELSE public.customers.name
        END,
        visit_count = public.customers.visit_count + 1,
        last_visit_at = now(),
        dpdp_marketing_consent =
          public.customers.dpdp_marketing_consent
          OR EXCLUDED.dpdp_marketing_consent,
        consent_collected_at = CASE
          WHEN EXCLUDED.dpdp_marketing_consent THEN now()
          ELSE public.customers.consent_collected_at
        END,
        updated_at = now()
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = CASE
          WHEN name IS NULL OR btrim(name) = '' THEN v_customer_name
          ELSE name
        END,
        visit_count = visit_count + 1,
        last_visit_at = now(),
        dpdp_marketing_consent =
          dpdp_marketing_consent OR COALESCE(p_marketing_consent, false),
        consent_collected_at = CASE
          WHEN COALESCE(p_marketing_consent, false) THEN now()
          ELSE consent_collected_at
        END,
        updated_at = now()
    WHERE id = v_customer_id
      AND shop_id = p_shop_id;
  END IF;

  INSERT INTO public.customer_visits (
    shop_id,
    customer_id,
    tag_id
  ) VALUES (
    p_shop_id,
    v_customer_id,
    p_tag_id
  )
  RETURNING id INTO v_visit_id;

  IF COALESCE(p_marketing_consent, false) THEN
    INSERT INTO public.consent_logs (
      shop_id,
      customer_id,
      purpose,
      status,
      consent_method,
      collected_by,
      metadata
    ) VALUES (
      p_shop_id,
      v_customer_id,
      'whatsapp_marketing',
      'granted',
      'verbal_recorded',
      auth.uid(),
      jsonb_build_object(
        'source', 'customer_visit',
        'visit_id', v_visit_id
      )
    );
  END IF;

  -- Flat and server-owned: no amount or caller-supplied points parameter.
  INSERT INTO public.loyalty_ledger (
    shop_id,
    customer_id,
    invoice_id,
    entry_type,
    points,
    running_balance,
    description
  ) VALUES (
    p_shop_id,
    v_customer_id,
    NULL,
    'earn',
    v_points_awarded,
    0,
    'Customer visit'
  )
  RETURNING running_balance INTO v_loyalty_balance;

  -- Same 14-day, most-recent-unconverted attribution as save_invoice.
  UPDATE public.message_logs
  SET converted_at       = now(),
      conversion_visit_id = v_visit_id
  WHERE id = (
    SELECT ml.id
    FROM public.message_logs ml
    WHERE ml.customer_id  = v_customer_id
      AND ml.shop_id      = p_shop_id
      AND ml.converted_at IS NULL
      AND ml.sent_at      >= now() - interval '14 days'
    ORDER BY ml.sent_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'visit_id', v_visit_id,
    'points_awarded', v_points_awarded,
    'loyalty_balance', v_loyalty_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.log_customer_visit(uuid, text, text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_customer_visit(uuid, text, text, uuid, boolean)
  TO authenticated;

-- -------------------------------------------------------------------------
-- 5. Count visit-sourced conversions; revenue remains completed-invoice-only
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_retention_stats(
  p_shop_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS jsonb AS $$
DECLARE
  v_messages_sent      bigint;
  v_customers_returned bigint;
  v_revenue_paise      bigint;
  v_active_rules       bigint;
  v_per_rule           jsonb;
BEGIN
  PERFORM public.assert_authenticated_shop(p_shop_id);

  SELECT count(*)
  INTO v_messages_sent
  FROM public.message_logs ml
  WHERE ml.shop_id = p_shop_id
    AND ml.sent_at >= p_start
    AND ml.sent_at < p_end;

  SELECT count(DISTINCT ml.customer_id),
         COALESCE(SUM(inv.total_paise), 0)
  INTO v_customers_returned, v_revenue_paise
  FROM public.message_logs ml
  LEFT JOIN public.invoices inv
    ON inv.id = ml.conversion_invoice_id
   AND inv.status = 'completed'
  WHERE ml.shop_id = p_shop_id
    AND ml.converted_at >= p_start
    AND ml.converted_at < p_end;

  SELECT count(*)
  INTO v_active_rules
  FROM public.campaign_rules cr
  WHERE cr.shop_id = p_shop_id
    AND cr.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'rule_id', r.rule_id,
        'rule_name', r.rule_name,
        'tag_name', r.tag_name,
        'is_active', r.is_active,
        'sent', r.sent,
        'returned', r.returned,
        'revenue_paise', r.revenue_paise
      )
      ORDER BY r.revenue_paise DESC, r.sent DESC, r.rule_name
    ),
    '[]'::jsonb
  )
  INTO v_per_rule
  FROM (
    SELECT
      cr.id   AS rule_id,
      cr.name AS rule_name,
      t.name  AS tag_name,
      cr.is_active,
      count(ml.id) FILTER (
        WHERE ml.sent_at >= p_start AND ml.sent_at < p_end
      ) AS sent,
      count(DISTINCT ml.customer_id) FILTER (
        WHERE ml.converted_at >= p_start AND ml.converted_at < p_end
      ) AS returned,
      COALESCE(SUM(inv.total_paise) FILTER (
        WHERE ml.converted_at >= p_start AND ml.converted_at < p_end
      ), 0) AS revenue_paise
    FROM public.campaign_rules cr
    JOIN public.tags t ON t.id = cr.tag_id
    LEFT JOIN public.message_logs ml ON ml.rule_id = cr.id
    LEFT JOIN public.invoices inv
      ON inv.id = ml.conversion_invoice_id
     AND inv.status = 'completed'
    WHERE cr.shop_id = p_shop_id
    GROUP BY cr.id, cr.name, t.name, cr.is_active
  ) r;

  RETURN jsonb_build_object(
    'messages_sent', v_messages_sent,
    'customers_returned', v_customers_returned,
    'revenue_attributed_paise', v_revenue_paise,
    'active_rules_count', v_active_rules,
    'per_rule', v_per_rule
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_retention_stats(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_retention_stats(uuid, timestamptz, timestamptz)
  TO authenticated;

COMMIT;
