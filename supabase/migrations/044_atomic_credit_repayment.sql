-- =========================================================================
-- Migration 044: Atomic credit repayment
--
-- Locks the customer balance, rejects overpayment, records the ledger entry,
-- and updates the denormalized balance in one database transaction.
-- =========================================================================

CREATE OR REPLACE FUNCTION record_credit_repayment(
  p_shop_id uuid,
  p_customer_id uuid,
  p_amount_paise bigint,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_current_balance bigint;
  v_new_balance bigint;
  v_ledger_id uuid;
BEGIN
  PERFORM assert_authenticated_shop(p_shop_id);

  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Repayment amount must be greater than zero';
  END IF;

  SELECT c.credit_balance_paise
  INTO v_current_balance
  FROM customers c
  WHERE c.id = p_customer_id
    AND c.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % does not belong to shop %', p_customer_id, p_shop_id;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);

  IF p_amount_paise > v_current_balance THEN
    RAISE EXCEPTION 'Repayment % exceeds outstanding balance %',
      p_amount_paise, v_current_balance;
  END IF;

  v_new_balance := v_current_balance - p_amount_paise;

  INSERT INTO credit_ledger (
    shop_id,
    customer_id,
    invoice_id,
    amount_paise,
    transaction_type,
    notes
  ) VALUES (
    p_shop_id,
    p_customer_id,
    NULL,
    p_amount_paise,
    'payment_received',
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_ledger_id;

  UPDATE customers
  SET credit_balance_paise = v_new_balance,
      updated_at = now()
  WHERE id = p_customer_id
    AND shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'ledger_id', v_ledger_id,
    'previous_balance_paise', v_current_balance,
    'new_balance_paise', v_new_balance,
    'amount_paise', p_amount_paise
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION record_credit_repayment(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_credit_repayment(uuid, uuid, bigint, text) FROM anon;
GRANT EXECUTE ON FUNCTION record_credit_repayment(uuid, uuid, bigint, text) TO authenticated;
