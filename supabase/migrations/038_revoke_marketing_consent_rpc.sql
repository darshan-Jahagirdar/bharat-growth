-- =========================================================================
-- Migration 038: revoke_marketing_consent_by_phone() RPC
--
-- Opt-out handler for the inbound WhatsApp webhook. The platform sends from
-- ONE WhatsApp number on behalf of all shops, so a customer replying STOP
-- must be opted out of marketing across EVERY shop that holds their number.
--
-- Phone matching is by last 10 digits of the normalized number: POS stores
-- '+919876543210', the storefront stores bare digits, and Meta wa_id is
-- '919876543210' - last-10 matching bridges all three formats.
--
-- Only rows currently opted in are touched (repeated STOPs do not spam the
-- append-only consent_logs). status must be 'withdrawn' per the CHECK
-- constraint in migration 004.
--
-- Service-role only: called by the webhook route via the admin client.
-- =========================================================================

CREATE OR REPLACE FUNCTION revoke_marketing_consent_by_phone(
  p_phone   text,
  p_keyword text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_digits  text;
  v_last10  text;
  v_revoked integer := 0;
  v_row     record;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  -- Safety guard: never mass-match on a short string.
  IF char_length(v_digits) < 10 THEN
    RETURN 0;
  END IF;

  v_last10 := right(v_digits, 10);

  FOR v_row IN
    UPDATE customers
    SET dpdp_marketing_consent = false,
        updated_at = now()
    WHERE dpdp_marketing_consent = true
      AND phone_number IS NOT NULL
      AND phone_number NOT LIKE 'ERASED-%'
      AND right(regexp_replace(phone_number, '\D', '', 'g'), 10) = v_last10
    RETURNING id, shop_id
  LOOP
    INSERT INTO consent_logs (
      shop_id, customer_id, purpose, status, consent_method, metadata
    ) VALUES (
      v_row.shop_id,
      v_row.id,
      'whatsapp_marketing',
      'withdrawn',
      'whatsapp_opt_in',
      jsonb_build_object(
        'source', 'whatsapp_webhook',
        'wa_id', v_digits,
        'keyword', p_keyword
      )
    );

    v_revoked := v_revoked + 1;
  END LOOP;

  RETURN v_revoked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION revoke_marketing_consent_by_phone(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION revoke_marketing_consent_by_phone(text, text) TO service_role;
