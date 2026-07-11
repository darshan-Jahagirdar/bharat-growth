-- =========================================================================
-- Migration 037: find_campaign_matches() RPC
--
-- The campaign cron previously matched invoices in JS with no consent check.
-- This RPC is now the single source of match logic, and it enforces:
--   * dpdp_marketing_consent = true (DPDP compliance gate)
--   * invoices.status = 'completed' (no nudges for cancelled/pending orders)
--   * IST date matching computed in SQL, with a 2-day grace window so a
--     missed cron run does not permanently lose a cohort (dedupe keeps
--     the window idempotent)
--   * dedupe on (invoice_id, rule_id) against message_logs
--   * one message per customer per run + 7-day per-customer cooldown
--     (protects the platform WhatsApp number's Meta quality rating)
--   * per-shop daily send cap (p_daily_cap, counted in IST)
--
-- Service-role only: called by the cron route via the admin client.
-- =========================================================================

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
