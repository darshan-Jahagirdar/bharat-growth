-- =========================================================================
-- Migration 048: Make loyalty balance derivation order-independent
--
-- Multiple ledger rows can share a timestamp and UUID order is not insertion
-- order. Derive the new balance from the sum of prior points while holding the
-- existing per-customer advisory lock.
-- =========================================================================

CREATE OR REPLACE FUNCTION set_loyalty_running_balance()
RETURNS trigger AS $$
DECLARE
  v_previous_balance integer;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.shop_id::text || ':' || NEW.customer_id::text || ':loyalty')
  );

  SELECT COALESCE(SUM(ll.points), 0)
  INTO v_previous_balance
  FROM loyalty_ledger ll
  WHERE ll.shop_id = NEW.shop_id
    AND ll.customer_id = NEW.customer_id
    AND ll.deleted_at IS NULL;

  NEW.running_balance := v_previous_balance + NEW.points;

  IF NEW.running_balance < 0 THEN
    RAISE EXCEPTION 'Loyalty balance cannot become negative for customer %', NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION set_loyalty_running_balance() FROM PUBLIC;
