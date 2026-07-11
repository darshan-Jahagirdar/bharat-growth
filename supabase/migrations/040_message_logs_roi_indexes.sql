-- =========================================================================
-- Migration 040: message_logs indexes for ROI stats + campaign engine
--
-- Migration 017 only indexed (customer_id, converted_at WHERE NULL) and
-- (invoice_id, rule_id). The Bring-Back engine adds hot paths:
--   * per-shop daily send cap counting          -> (shop_id, sent_at)
--   * "brought back this month" ROI aggregation -> (shop_id, converted_at)
--   * conversion invoice FK maintenance         -> (conversion_invoice_id)
--     (invoices ON DELETE SET NULL would otherwise seq-scan message_logs)
--   * per-rule stats + rule delete cascade      -> (rule_id)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_message_logs_shop_sent
  ON message_logs (shop_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_shop_converted
  ON message_logs (shop_id, converted_at DESC)
  WHERE converted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_logs_conversion_inv
  ON message_logs (conversion_invoice_id)
  WHERE conversion_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_logs_rule
  ON message_logs (rule_id);
