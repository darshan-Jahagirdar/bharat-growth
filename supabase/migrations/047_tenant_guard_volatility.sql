-- =========================================================================
-- Migration 047: Declare the read-only tenant guard STABLE
--
-- The guard only validates auth.uid() against public.users. Declaring its
-- correct volatility allows read-only STABLE reporting RPCs to call it without
-- PostgreSQL volatility warnings.
-- =========================================================================

CREATE OR REPLACE FUNCTION assert_authenticated_shop(p_shop_id uuid)
RETURNS void AS $$
DECLARE
  v_caller_shop_id uuid;
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  SELECT shop_id
  INTO v_caller_shop_id
  FROM public.users
  WHERE id = auth.uid()
    AND is_active = true;

  IF v_caller_shop_id IS NULL OR v_caller_shop_id IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'Unauthorized: user does not belong to shop %', p_shop_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION assert_authenticated_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_authenticated_shop(uuid) TO authenticated;
