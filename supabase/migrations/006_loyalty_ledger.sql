-- =========================================================================
-- Migration 006: Loyalty Ledger (points earned vs redeemed)
-- =========================================================================

CREATE TABLE loyalty_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  entry_type      text NOT NULL CHECK (entry_type IN ('earn','redeem','expire','adjust')),
  points          integer NOT NULL,
  running_balance integer NOT NULL,
  description     text,
  expires_at      timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_shop_customer ON loyalty_ledger (shop_id, customer_id, created_at DESC);
CREATE INDEX idx_loyalty_shop_invoice ON loyalty_ledger (shop_id, invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_loyalty_shop_type ON loyalty_ledger (shop_id, customer_id, entry_type);
CREATE INDEX idx_loyalty_expiry ON loyalty_ledger (shop_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE TRIGGER set_loyalty_ledger_updated_at BEFORE UPDATE ON loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
