-- =========================================================================
-- Migration 017: Automated Retention & Attribution Engine
-- Tags → Campaign Rules → Message Logs → Attribution Loop
-- =========================================================================

-- ── 1. Tags table ──

CREATE TABLE tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

-- ── 2. Add tag_id to products ──

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES tags(id) ON DELETE SET NULL;

-- ── 3. Campaign Rules table ──

CREATE TABLE campaign_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tag_id           uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  trigger_days     integer NOT NULL CHECK (trigger_days > 0),
  message_template text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Message Logs table (the attribution ledger) ──

CREATE TABLE message_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id            uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  rule_id               uuid NOT NULL REFERENCES campaign_rules(id) ON DELETE CASCADE,
  sent_at               timestamptz NOT NULL DEFAULT now(),
  converted_at          timestamptz,
  conversion_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,

  -- Prevent duplicate sends for the same purchase + rule
  UNIQUE (invoice_id, rule_id)
);

-- ── 5. RLS ──

ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_rules  FORCE ROW LEVEL SECURITY;
ALTER TABLE message_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs    FORCE ROW LEVEL SECURITY;

-- Tags: tenant-isolated CRUD
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()));

-- Campaign Rules: tenant-isolated CRUD
CREATE POLICY "campaign_rules_select" ON campaign_rules FOR SELECT TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "campaign_rules_insert" ON campaign_rules FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "campaign_rules_update" ON campaign_rules FOR UPDATE TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "campaign_rules_delete" ON campaign_rules FOR DELETE TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()));

-- Message Logs: tenant-isolated read + insert (no update/delete by user)
CREATE POLICY "message_logs_select" ON message_logs FOR SELECT TO authenticated
  USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY "message_logs_insert" ON message_logs FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── 6. Indexes for the cron engine ──

CREATE INDEX idx_message_logs_customer_conversion
  ON message_logs (customer_id, converted_at)
  WHERE converted_at IS NULL;

CREATE INDEX idx_message_logs_invoice_rule
  ON message_logs (invoice_id, rule_id);

CREATE INDEX idx_products_tag
  ON products (tag_id)
  WHERE tag_id IS NOT NULL;

CREATE INDEX idx_campaign_rules_active
  ON campaign_rules (shop_id, tag_id)
  WHERE is_active = true;

-- ── 7. Update save_invoice RPC — add attribution loop ──

CREATE OR REPLACE FUNCTION save_invoice(
  p_invoice       jsonb,
  p_items         jsonb,
  p_loyalty_entry jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_invoice_id     uuid;
  v_shop_id        uuid;
  v_customer_id    uuid;
  v_fy             varchar(7);
  v_next_seq       integer;
  v_invoice_number text;
  v_item           jsonb;
  v_result         jsonb;
BEGIN
  -- ── Extract shop_id and validate ──
  v_shop_id := (p_invoice->>'shop_id')::uuid;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  -- ── Generate sequential invoice number (with advisory lock) ──
  v_fy := get_financial_year((p_invoice->>'invoice_date')::date);

  PERFORM pg_advisory_xact_lock(hashtext(v_shop_id::text || v_fy));

  SELECT COALESCE(MAX(invoice_sequence), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE shop_id = v_shop_id AND financial_year = v_fy;

  v_invoice_number := 'BG/' || v_fy || '/' || LPAD(v_next_seq::text, 5, '0');
  v_invoice_id := gen_random_uuid();

  -- ── 1. Insert invoice ──
  INSERT INTO invoices (
    id, shop_id, invoice_number, invoice_sequence, financial_year,
    invoice_date, invoice_type, document_type,
    customer_id, customer_name, customer_phone, customer_gstin,
    billing_state_code, is_inter_state,
    subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
    discount_paise, round_off_paise, total_paise,
    payment_mode, payment_reference, status, created_by
  ) VALUES (
    v_invoice_id,
    v_shop_id,
    v_invoice_number,
    v_next_seq,
    v_fy,
    COALESCE((p_invoice->>'invoice_date')::date, CURRENT_DATE),
    COALESCE(p_invoice->>'invoice_type', 'regular'),
    COALESCE(p_invoice->>'document_type', 'tax_invoice'),
    (p_invoice->>'customer_id')::uuid,
    p_invoice->>'customer_name',
    p_invoice->>'customer_phone',
    p_invoice->>'customer_gstin',
    COALESCE(p_invoice->>'billing_state_code', '27'),
    COALESCE((p_invoice->>'is_inter_state')::boolean, false),
    (p_invoice->>'subtotal_paise')::bigint,
    COALESCE((p_invoice->>'cgst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'sgst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'igst_total_paise')::bigint, 0),
    COALESCE((p_invoice->>'discount_paise')::bigint, 0),
    COALESCE((p_invoice->>'round_off_paise')::bigint, 0),
    (p_invoice->>'total_paise')::bigint,
    COALESCE(p_invoice->>'payment_mode', 'cash'),
    p_invoice->>'payment_reference',
    'completed',
    (p_invoice->>'created_by')::uuid
  );

  -- ── 2. Insert all invoice items ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_items (
      id, shop_id, invoice_id, product_id,
      product_name, hsn_code, quantity, unit, unit_price_paise,
      discount_paise, taxable_amount_paise, gst_rate_percent,
      cgst_paise, sgst_paise, igst_paise, total_paise,
      batch_number
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      v_invoice_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'hsn_code',
      (v_item->>'quantity')::numeric,
      v_item->>'unit',
      (v_item->>'unit_price_paise')::bigint,
      COALESCE((v_item->>'discount_paise')::bigint, 0),
      (v_item->>'taxable_amount_paise')::bigint,
      (v_item->>'gst_rate_percent')::smallint,
      COALESCE((v_item->>'cgst_paise')::bigint, 0),
      COALESCE((v_item->>'sgst_paise')::bigint, 0),
      COALESCE((v_item->>'igst_paise')::bigint, 0),
      (v_item->>'total_paise')::bigint,
      v_item->>'batch_number'
    );
  END LOOP;

  -- ── 3. Insert loyalty entry (if provided) ──
  IF p_loyalty_entry IS NOT NULL AND p_loyalty_entry->>'customer_id' IS NOT NULL THEN
    INSERT INTO loyalty_ledger (
      id, shop_id, customer_id, invoice_id,
      entry_type, points, running_balance, description
    ) VALUES (
      gen_random_uuid(),
      v_shop_id,
      (p_loyalty_entry->>'customer_id')::uuid,
      v_invoice_id,
      COALESCE(p_loyalty_entry->>'entry_type', 'earn'),
      (p_loyalty_entry->>'points')::integer,
      (p_loyalty_entry->>'running_balance')::integer,
      COALESCE(p_loyalty_entry->>'description', 'Purchase ' || v_invoice_number)
    );

    -- Update customer denormalized fields
    UPDATE customers SET
      total_spent_paise = total_spent_paise + (p_invoice->>'total_paise')::bigint,
      visit_count = visit_count + 1,
      last_visit_at = now()
    WHERE id = (p_loyalty_entry->>'customer_id')::uuid
      AND shop_id = v_shop_id;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 4. ATTRIBUTION LOOP — mark the most recent unconverted message as
  --    converted if this customer was messaged within the last 14 days
  -- ══════════════════════════════════════════════════════════════════════
  v_customer_id := (p_invoice->>'customer_id')::uuid;

  IF v_customer_id IS NOT NULL THEN
    UPDATE message_logs
    SET converted_at          = now(),
        conversion_invoice_id = v_invoice_id
    WHERE id = (
      SELECT ml.id
      FROM message_logs ml
      WHERE ml.customer_id  = v_customer_id
        AND ml.shop_id      = v_shop_id
        AND ml.converted_at IS NULL
        AND ml.sent_at      >= now() - interval '14 days'
      ORDER BY ml.sent_at DESC
      LIMIT 1
    );
  END IF;

  -- ── Return the created invoice summary ──
  v_result := jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'invoice_sequence', v_next_seq,
    'financial_year', v_fy,
    'total_paise', (p_invoice->>'total_paise')::bigint
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
