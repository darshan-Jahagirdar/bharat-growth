-- =========================================================================
-- Migration 009: Views
-- =========================================================================

-- Current consent status per customer per purpose (latest entry wins)
CREATE VIEW current_consent AS
SELECT DISTINCT ON (shop_id, customer_id, purpose)
  shop_id,
  customer_id,
  purpose,
  status,
  consent_method,
  created_at AS consented_at
FROM consent_logs
ORDER BY shop_id, customer_id, purpose, created_at DESC;
