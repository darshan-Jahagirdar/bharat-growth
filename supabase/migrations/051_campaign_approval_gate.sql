-- =========================================================================
-- Migration 051: campaign approval gate
--
-- Every shop sends through one shared platform WhatsApp number. Campaign
-- matching is disabled by default per shop and must be manually approved by
-- BharatGrowth before the cron can return a send candidate.
--
-- Shop users may request approval, but the database prevents anon and
-- authenticated roles from changing the approval decision or its audit time.
-- =========================================================================

ALTER TABLE public.shops
  ADD COLUMN campaigns_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN campaigns_approved_at timestamptz,
  ADD COLUMN campaigns_approval_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.prevent_shop_campaign_approval_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (
       NEW.campaigns_approved IS DISTINCT FROM OLD.campaigns_approved
       OR NEW.campaigns_approved_at IS DISTINCT FROM OLD.campaigns_approved_at
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'campaign approval is managed by BharatGrowth and cannot be changed by shop users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE ALL ON FUNCTION public.prevent_shop_campaign_approval_mutation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_shop_campaign_approval_mutation
  BEFORE UPDATE OF campaigns_approved, campaigns_approved_at ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.prevent_shop_campaign_approval_mutation();

CREATE OR REPLACE FUNCTION find_campaign_matches(p_daily_cap integer DEFAULT 50)
RETURNS TABLE (
  shop_id         uuid,
  shop_name       text,
  customer_id     uuid,
  customer_name   text,
  customer_phone  text,
  invoice_id      uuid,
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
  raw_matches AS (
    SELECT
      cr.shop_id,
      s.business_name AS shop_name,
      c.id            AS customer_id,
      c.name          AS customer_name,
      c.phone_number  AS customer_phone,
      i.id            AS invoice_id,
      cr.id           AS rule_id,
      cr.name         AS rule_name,
      t.name          AS tag_name,
      cr.template_key,
      cr.custom_variable,
      -- one message per customer per run (most recent qualifying purchase wins)
      row_number() OVER (
        PARTITION BY c.id
        ORDER BY i.invoice_date DESC, i.id
      ) AS customer_rank
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
  capped AS (
    SELECT
      rm.*,
      row_number() OVER (PARTITION BY rm.shop_id ORDER BY rm.invoice_id) AS shop_rank,
      COALESCE(st.cnt, 0) AS already_sent_today
    FROM raw_matches rm
    LEFT JOIN sent_today st ON st.shop_id = rm.shop_id
    WHERE rm.customer_rank = 1
  )
  SELECT
    shop_id, shop_name, customer_id, customer_name, customer_phone,
    invoice_id, rule_id, rule_name, tag_name, template_key, custom_variable
  FROM capped
  WHERE shop_rank + already_sent_today <= p_daily_cap;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION find_campaign_matches(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_campaign_matches(integer) TO service_role;
