-- =========================================================================
-- Migration 053: Idempotent visit capture + one-per-visit acknowledgement
--
-- The customer_visits row remains append-only. A caller-owned request UUID
-- makes the entire visit transaction replay-safe, while a separate narrow
-- claim table prevents duplicate paid acknowledgements without polluting
-- message_logs (the campaign attribution and ROI ledger).
-- =========================================================================

BEGIN;

-- Existing Wave C rows remain valid. New application callers are forced
-- through the replaced RPC, which requires a request UUID.
ALTER TABLE public.customer_visits
  ADD COLUMN request_id uuid;

CREATE UNIQUE INDEX customer_visits_shop_request_uidx
  ON public.customer_visits (shop_id, request_id)
  WHERE request_id IS NOT NULL;

-- Dashboard capture instrumentation measures when the visit was recorded.
CREATE INDEX idx_customer_visits_shop_created_at
  ON public.customer_visits (shop_id, created_at);

DROP FUNCTION public.log_customer_visit(uuid, text, text, uuid, boolean);

CREATE FUNCTION public.log_customer_visit(
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
    tag_id,
    request_id
  ) VALUES (
    p_shop_id,
    v_customer_id,
    p_tag_id,
    p_request_id
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

-- A separate claim keeps visit rows append-only and keeps acknowledgements
-- outside the campaign attribution/cooldown/daily-cap/ROI ledger.
CREATE TABLE public.visit_acknowledgement_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  visit_id   uuid NOT NULL UNIQUE
             REFERENCES public.customer_visits(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_acknowledgement_claims_shop_claimed
  ON public.visit_acknowledgement_claims (shop_id, claimed_at DESC);

COMMENT ON TABLE public.visit_acknowledgement_claims IS
  'One durable claim per visit acknowledgement. Kept separate from append-only visits and campaign-attribution message_logs. Claims are conservatively retained after simulation, a successful send, or an ambiguous network outcome; only a definite pre-acceptance failure may delete one.';

ALTER TABLE public.visit_acknowledgement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_acknowledgement_claims FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.visit_acknowledgement_claims
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visit_acknowledgement_claims
  FROM service_role;
-- The SECURITY DEFINER claim RPC owns INSERT. The route only needs a narrow
-- service-role DELETE for definite pre-acceptance failures (plus SELECT on
-- predicate columns), so even service-role application code cannot construct
-- a mismatched (shop_id, visit_id) claim directly.
GRANT SELECT, DELETE ON TABLE public.visit_acknowledgement_claims
  TO service_role;

-- Service-only narrow claim. It atomically re-reads both independent send
-- gates and returns only database-derived template variables.
CREATE FUNCTION public.claim_visit_acknowledgement(
  p_shop_id  uuid,
  p_visit_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_claim_id          uuid;
  v_existing_claim_id uuid;
  v_customer_id       uuid;
  v_customer_name     text;
  v_customer_phone    text;
  v_shop_name         text;
  v_campaigns_approved boolean;
  v_marketing_consent  boolean;
  v_loyalty_balance    integer;
BEGIN
  IF p_shop_id IS NULL OR p_visit_id IS NULL THEN
    RAISE EXCEPTION 'shop_id and visit_id are required';
  END IF;

  SELECT
    cv.customer_id,
    c.name,
    c.phone_number,
    c.dpdp_marketing_consent,
    s.business_name,
    s.campaigns_approved
  INTO
    v_customer_id,
    v_customer_name,
    v_customer_phone,
    v_marketing_consent,
    v_shop_name,
    v_campaigns_approved
  FROM public.customer_visits cv
  JOIN public.customers c
    ON c.id = cv.customer_id
   AND c.shop_id = cv.shop_id
  JOIN public.shops s
    ON s.id = cv.shop_id
  WHERE cv.id = p_visit_id
    AND cv.shop_id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit % does not belong to shop %', p_visit_id, p_shop_id;
  END IF;

  IF v_campaigns_approved IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'campaign_approval_required'
    );
  END IF;

  IF v_marketing_consent IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'whatsapp_consent_required'
    );
  END IF;

  INSERT INTO public.visit_acknowledgement_claims (
    shop_id,
    visit_id
  ) VALUES (
    p_shop_id,
    p_visit_id
  )
  ON CONFLICT (visit_id) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NULL THEN
    SELECT id
    INTO v_existing_claim_id
    FROM public.visit_acknowledgement_claims
    WHERE visit_id = p_visit_id;

    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'already_claimed',
      'claim_id', v_existing_claim_id
    );
  END IF;

  SELECT COALESCE(SUM(ll.points), 0)::integer
  INTO v_loyalty_balance
  FROM public.loyalty_ledger ll
  WHERE ll.shop_id = p_shop_id
    AND ll.customer_id = v_customer_id
    AND ll.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'claimed', true,
    'claim_id', v_claim_id,
    'customer_id', v_customer_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'shop_name', v_shop_name,
    'points_awarded', 1,
    'loyalty_balance', v_loyalty_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_visit_acknowledgement(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_visit_acknowledgement(uuid, uuid)
  TO service_role;

COMMIT;
