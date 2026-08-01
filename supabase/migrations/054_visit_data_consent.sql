-- =========================================================================
-- Migration 054: Required data consent for customer visits
--
-- Recording a visit necessarily stores customer identity and visit context.
-- Data-collection consent is therefore unconditional for this RPC, while
-- WhatsApp marketing consent remains optional and caller-recorded.
-- =========================================================================

BEGIN;

-- Repair non-erased customers who already have a visit. The visit itself is
-- the source event for required data consent. Never re-consent an anonymized
-- customer or override a later, explicit data-collection withdrawal.
WITH corrected_visit_customers AS (
  UPDATE public.customers c
  SET dpdp_data_consent = true,
      consent_collected_at = COALESCE(c.consent_collected_at, now()),
      updated_at = now()
  WHERE c.dpdp_data_consent IS DISTINCT FROM true
    AND c.phone_number NOT LIKE 'ERASED-%'
    AND COALESCE(
      (
        SELECT cl.status
        FROM public.consent_logs cl
        WHERE cl.shop_id = c.shop_id
          AND cl.customer_id = c.id
          AND cl.purpose = 'data_collection'
        ORDER BY cl.created_at DESC, cl.id DESC
        LIMIT 1
      ),
      'granted'
    ) <> 'withdrawn'
    AND EXISTS (
      SELECT 1
      FROM public.customer_visits cv
      WHERE cv.shop_id = c.shop_id
        AND cv.customer_id = c.id
    )
  RETURNING c.shop_id, c.id AS customer_id
)
INSERT INTO public.consent_logs (
  shop_id,
  customer_id,
  purpose,
  status,
  consent_method,
  collected_by,
  metadata
)
SELECT
  corrected.shop_id,
  corrected.customer_id,
  'data_collection',
  'granted',
  'verbal_recorded',
  NULL,
  jsonb_build_object(
    'source', 'customer_visit_backfill',
    'migration', '054'
  )
FROM corrected_visit_customers corrected;

CREATE OR REPLACE FUNCTION public.log_customer_visit(
  p_shop_id           uuid,
  p_request_id        uuid,
  p_phone_number      text,
  p_customer_name     text DEFAULT NULL,
  p_tag_id            uuid DEFAULT NULL,
  p_marketing_consent boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_digits            text;
  v_last10            text;
  v_phone_number      text;
  v_customer_name     text;
  v_customer_id       uuid;
  v_visit_id          uuid;
  v_loyalty_balance   integer;
  v_points_awarded    constant integer := 1;
  v_idempotent_replay boolean := false;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  PERFORM public.assert_authenticated_shop(p_shop_id);

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required';
  END IF;

  -- Serialize concurrent retries before any customer, consent, loyalty, or
  -- attribution side effect can occur.
  PERFORM pg_advisory_xact_lock(
    hashtext(
      p_shop_id::text
      || ':'
      || p_request_id::text
      || ':customer-visit-request'
    )
  );

  SELECT cv.id, cv.customer_id
  INTO v_visit_id, v_customer_id
  FROM public.customer_visits cv
  WHERE cv.shop_id = p_shop_id
    AND cv.request_id = p_request_id;

  IF FOUND THEN
    SELECT COALESCE(SUM(ll.points), 0)::integer
    INTO v_loyalty_balance
    FROM public.loyalty_ledger ll
    WHERE ll.shop_id = p_shop_id
      AND ll.customer_id = v_customer_id
      AND ll.deleted_at IS NULL;

    v_idempotent_replay := true;

    RETURN jsonb_build_object(
      'request_id', p_request_id,
      'customer_id', v_customer_id,
      'visit_id', v_visit_id,
      'points_awarded', v_points_awarded,
      'loyalty_balance', v_loyalty_balance,
      'idempotent_replay', v_idempotent_replay
    );
  END IF;

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

  -- Serialize callers for one shop/phone identity, including first create.
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
      dpdp_data_consent,
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
      true,
      COALESCE(p_marketing_consent, false),
      now()
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
        dpdp_data_consent =
          public.customers.dpdp_data_consent
          OR EXCLUDED.dpdp_data_consent,
        dpdp_marketing_consent =
          public.customers.dpdp_marketing_consent
          OR EXCLUDED.dpdp_marketing_consent,
        consent_collected_at = now(),
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
        dpdp_data_consent = dpdp_data_consent OR true,
        dpdp_marketing_consent =
          dpdp_marketing_consent OR COALESCE(p_marketing_consent, false),
        consent_collected_at = now(),
        updated_at = now()
    WHERE id = v_customer_id
      AND shop_id = p_shop_id;
  END IF;

  INSERT INTO public.customer_visits (
    shop_id,
    customer_id,
    tag_id,
    request_id
  ) VALUES (
    p_shop_id,
    v_customer_id,
    p_tag_id,
    p_request_id
  )
  RETURNING id INTO v_visit_id;

  -- Holding the identity + visit record requires data consent on every visit.
  -- It is separate from the optional WhatsApp marketing purpose below.
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
    'data_collection',
    'granted',
    'verbal_recorded',
    auth.uid(),
    jsonb_build_object(
      'source', 'customer_visit',
      'visit_id', v_visit_id
    )
  );

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
  SET converted_at        = now(),
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
    'request_id', p_request_id,
    'customer_id', v_customer_id,
    'visit_id', v_visit_id,
    'points_awarded', v_points_awarded,
    'loyalty_balance', v_loyalty_balance,
    'idempotent_replay', v_idempotent_replay
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.log_customer_visit(
  uuid,
  uuid,
  text,
  text,
  uuid,
  boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_customer_visit(
  uuid,
  uuid,
  text,
  text,
  uuid,
  boolean
) TO authenticated;

COMMENT ON FUNCTION public.log_customer_visit(
  uuid,
  uuid,
  text,
  text,
  uuid,
  boolean
) IS
  'Logs one idempotent, amount-free customer visit. Data-collection consent is unconditional and append-logged; WhatsApp marketing consent remains optional and OR-preserved.';

COMMIT;
