-- =========================================================================
-- Migration 004: Customers + DPDP Act 2026 Consent Logs
-- =========================================================================

CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                   uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone_number              varchar(15) NOT NULL,
  name                      text,
  email                     text,
  address                   text,
  gstin                     varchar(15),
  segment                   text NOT NULL DEFAULT 'new' CHECK (
                              segment IN ('new', 'regular', 'vip', 'dormant')
                            ),
  total_spent_paise         bigint NOT NULL DEFAULT 0,
  visit_count               integer NOT NULL DEFAULT 0,
  last_visit_at             timestamptz,
  dpdp_data_consent         boolean NOT NULL DEFAULT false,
  dpdp_marketing_consent    boolean NOT NULL DEFAULT false,
  dpdp_data_sharing_consent boolean NOT NULL DEFAULT false,
  consent_collected_at      timestamptz,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_shop_phone ON customers (shop_id, phone_number);
CREATE INDEX idx_customers_shop_name ON customers (shop_id, name) WHERE name IS NOT NULL;
CREATE INDEX idx_customers_shop_segment ON customers (shop_id, segment);
CREATE INDEX idx_customers_shop_last_visit ON customers (shop_id, last_visit_at);
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- Consent Logs — IMMUTABLE append-only audit trail (DPDP Act 2026)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE consent_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose        text NOT NULL CHECK (
                   purpose IN ('data_collection','whatsapp_marketing','data_sharing','analytics','erasure_request')
                 ),
  status         text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  consent_method text NOT NULL CHECK (
                   consent_method IN ('in_app','whatsapp_opt_in','verbal_recorded','sms','paper')
                 ),
  ip_address     inet,
  user_agent     text,
  collected_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_shop_customer_purpose ON consent_logs (shop_id, customer_id, purpose, created_at DESC);
CREATE INDEX idx_consent_shop_customer ON consent_logs (shop_id, customer_id, created_at DESC);
CREATE INDEX idx_consent_shop_purpose_status ON consent_logs (shop_id, purpose, status);

CREATE TRIGGER consent_logs_immutable
  BEFORE UPDATE OR DELETE ON consent_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_consent_log_mutation();

-- ─────────────────────────────────────────────────────────────────
-- DPDP Act 2026: Anonymize customer PII, preserve invoice integrity
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION anonymize_customer(
  p_customer_id  uuid,
  p_shop_id      uuid,
  p_requested_by uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_anon_token text;
BEGIN
  v_anon_token := 'ERASED-' || p_customer_id::text;

  UPDATE customers SET
    phone_number              = v_anon_token,
    name                      = 'Anonymized Customer',
    email                     = NULL,
    address                   = NULL,
    gstin                     = NULL,
    notes                     = NULL,
    dpdp_data_consent         = false,
    dpdp_marketing_consent    = false,
    dpdp_data_sharing_consent = false,
    consent_collected_at      = now(),
    updated_at                = now()
  WHERE id = p_customer_id AND shop_id = p_shop_id;

  INSERT INTO consent_logs (
    shop_id, customer_id, purpose, status, consent_method, collected_by, metadata
  ) VALUES (
    p_shop_id, p_customer_id, 'erasure_request', 'granted', 'in_app', p_requested_by,
    jsonb_build_object(
      'action', 'pii_anonymized',
      'anonymized_at', now()::text,
      'fields_cleared', ARRAY['phone_number','name','email','address','gstin','notes']
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
