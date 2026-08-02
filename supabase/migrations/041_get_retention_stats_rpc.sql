-- =========================================================================
-- Migration 041: get_retention_stats() RPC
--
-- The rupee-proof behind the Bring-Back engine: aggregates message_logs +
-- the attribution loop into "BharatGrowth brought back N customers worth
-- X paise this period", plus a per-rule breakdown for the campaigns page.
--
-- Semantics:
--   * messages_sent          counts by sent_at in [p_start, p_end)
--   * customers_returned /   count by converted_at in [p_start, p_end) —
--     revenue_attributed     a message sent last month that converts this
--                            month counts in THIS month's revenue
--   * revenue only counts conversion invoices with status = 'completed'
--
-- RPC (not client-side joins) because conversion_invoice_id is a second FK
-- to invoices, which PostgREST embedding handles poorly, and the campaigns
-- page reuses the per-rule breakdown.
--
-- Guarded by assert_authenticated_shop (migration 032 pattern).
-- =========================================================================

CREATE OR REPLACE FUNCTION get_retention_stats(
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
  PERFORM assert_authenticated_shop(p_shop_id);

  SELECT count(*)
  INTO v_messages_sent
  FROM message_logs ml
  WHERE ml.shop_id = p_shop_id
    AND ml.sent_at >= p_start
    AND ml.sent_at < p_end;

  SELECT count(DISTINCT ml.customer_id),
         COALESCE(SUM(inv.total_paise), 0)
  INTO v_customers_returned, v_revenue_paise
  FROM message_logs ml
  JOIN invoices inv
    ON inv.id = ml.conversion_invoice_id
   AND inv.status = 'completed'
  WHERE ml.shop_id = p_shop_id
    AND ml.converted_at >= p_start
    AND ml.converted_at < p_end;

  SELECT count(*)
  INTO v_active_rules
  FROM campaign_rules cr
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
          AND inv.id IS NOT NULL
      ) AS returned,
      COALESCE(SUM(inv.total_paise) FILTER (
        WHERE ml.converted_at >= p_start AND ml.converted_at < p_end
      ), 0) AS revenue_paise
    FROM campaign_rules cr
    JOIN tags t ON t.id = cr.tag_id
    LEFT JOIN message_logs ml ON ml.rule_id = cr.id
    LEFT JOIN invoices inv
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

REVOKE EXECUTE ON FUNCTION get_retention_stats(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_retention_stats(uuid, timestamptz, timestamptz) TO authenticated;
