-- =========================================================================
-- Migration 046: Atomic AI scan quota consumption
-- =========================================================================

CREATE OR REPLACE FUNCTION consume_ai_scan(p_shop_id uuid)
RETURNS integer AS $$
DECLARE
  v_remaining integer;
BEGIN
  PERFORM assert_authenticated_shop(p_shop_id);

  UPDATE shops
  SET monthly_ai_scans = monthly_ai_scans - 1,
      updated_at = now()
  WHERE id = p_shop_id
    AND monthly_ai_scans > 0
  RETURNING monthly_ai_scans INTO v_remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan quota exceeded';
  END IF;

  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION consume_ai_scan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_ai_scan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION consume_ai_scan(uuid) TO authenticated;
