-- =========================================================================
-- Migration 055: Public receipt loyalty + anonymous table-grant cleanup
--
-- Migration 049 built its cleanup list from tables carrying anon policies.
-- That missed grant-only tables whose tenant RLS happened to return zero rows
-- for anon. Those grants were not an active leak, but they were a silent
-- single-lock boundary: a future permissive policy could expose the table.
--
-- This migration restores the two-lock rule across the full public schema:
-- no direct anon table privilege remains except the exact storefront SELECT
-- column allowlists established by migration 049.
--
-- The receipt widening is deliberately narrow. Loyalty values are read only
-- through get_public_receipt(p_invoice_id), from the non-deleted earn ledger
-- row tied to the exact invoice, shop, and invoice customer. points is what
-- save_invoice actually credited; running_balance is the historical balance
-- derived and stored by the locked-SUM trigger in migrations 045/048.
-- =========================================================================

BEGIN;

DO $$
DECLARE
  v_missing_table text;
  v_public_grant text;
  v_column_drift text;
BEGIN
  SELECT expected.table_name
  INTO v_missing_table
  FROM (
    VALUES
      ('campaign_rules'),
      ('consent_logs'),
      ('credit_ledger'),
      ('customers'),
      ('inventory'),
      ('inventory_movements'),
      ('loyalty_ledger'),
      ('message_logs'),
      ('products'),
      ('purchase_bills'),
      ('purchase_order_items'),
      ('purchase_orders'),
      ('sales_order_items'),
      ('sales_orders'),
      ('shops'),
      ('tags')
  ) AS expected(table_name)
  WHERE to_regclass('public.' || expected.table_name) IS NULL
  ORDER BY expected.table_name
  LIMIT 1;

  IF v_missing_table IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 055 precondition failed: expected public table % is missing',
      v_missing_table;
  END IF;

  IF to_regprocedure('public.get_public_receipt(uuid)') IS NULL
     OR NOT has_function_privilege(
       'anon',
       'public.get_public_receipt(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION
      'migration 055 precondition failed: public receipt RPC is missing or not anon-executable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = 'public.get_public_receipt(uuid)'::regprocedure
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION
      'migration 055 precondition failed: public receipt RPC is not SECURITY DEFINER';
  END IF;

  -- PUBLIC has no live table/column grants on staging. Stop rather than
  -- silently changing a broader role if another environment has drifted.
  SELECT grant_row.object_name
  INTO v_public_grant
  FROM (
    SELECT c.relname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) acl
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND acl.grantee = 0

    UNION ALL

    SELECT c.relname || '.' || a.attname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attnum > 0
     AND NOT a.attisdropped
    CROSS JOIN LATERAL aclexplode(a.attacl) acl
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND acl.grantee = 0
  ) AS grant_row
  ORDER BY grant_row.object_name
  LIMIT 1;

  IF v_public_grant IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 055 precondition failed: unexpected PUBLIC grant on %',
      v_public_grant;
  END IF;

  -- The only explicit anon column ACLs must be migration 049's exact
  -- storefront allowlist. This makes an extra leaked column fail loudly.
  WITH expected(table_name, column_name, privilege_type) AS (
    VALUES
      ('shops', 'id', 'SELECT'),
      ('shops', 'business_name', 'SELECT'),
      ('shops', 'business_type', 'SELECT'),
      ('shops', 'city', 'SELECT'),
      ('shops', 'state_code', 'SELECT'),
      ('shops', 'logo_url', 'SELECT'),
      ('shops', 'theme_preference', 'SELECT'),
      ('shops', 'primary_color', 'SELECT'),
      ('products', 'id', 'SELECT'),
      ('products', 'name', 'SELECT'),
      ('products', 'sku', 'SELECT'),
      ('products', 'hsn_code', 'SELECT'),
      ('products', 'selling_price_paise', 'SELECT'),
      ('products', 'gst_rate_percent', 'SELECT'),
      ('products', 'unit', 'SELECT'),
      ('products', 'category', 'SELECT'),
      ('products', 'image_url', 'SELECT'),
      ('products', 'vertical_attrs', 'SELECT'),
      ('products', 'is_stock_tracked', 'SELECT'),
      ('products', 'shop_id', 'SELECT'),
      ('products', 'is_active', 'SELECT'),
      ('inventory', 'quantity_in_stock', 'SELECT'),
      ('inventory', 'product_id', 'SELECT')
  ),
  actual AS (
    SELECT
      c.relname AS table_name,
      a.attname AS column_name,
      acl.privilege_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attnum > 0
     AND NOT a.attisdropped
    CROSS JOIN LATERAL aclexplode(a.attacl) acl
    JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND grantee.rolname = 'anon'
  ),
  drift AS (
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    UNION ALL
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
  )
  SELECT
    drift.table_name || '.' || drift.column_name || ':' || drift.privilege_type
  INTO v_column_drift
  FROM drift
  ORDER BY drift.table_name, drift.column_name, drift.privilege_type
  LIMIT 1;

  IF v_column_drift IS NOT NULL THEN
    RAISE EXCEPTION
      'migration 055 precondition failed: anon column allowlist drift at %',
      v_column_drift;
  END IF;
END $$;

-- Tables with no legitimate direct anonymous consumer.
REVOKE ALL PRIVILEGES ON TABLE public.campaign_rules FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.consent_logs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.credit_ledger FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.customers FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.inventory_movements FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.loyalty_ledger FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.message_logs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.purchase_bills FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.purchase_order_items FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.purchase_orders FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.sales_order_items FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.sales_orders FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.tags FROM anon;

-- The storefront needs SELECT only, and only on migration 049's columns.
-- Remove its inherited table-level mutation/maintenance privileges, then
-- restate the exact column allowlists.
REVOKE ALL PRIVILEGES ON TABLE public.shops FROM anon;
GRANT SELECT (
  id,
  business_name,
  business_type,
  city,
  state_code,
  logo_url,
  theme_preference,
  primary_color
) ON TABLE public.shops TO anon;

REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon;
GRANT SELECT (
  id,
  name,
  sku,
  hsn_code,
  selling_price_paise,
  gst_rate_percent,
  unit,
  category,
  image_url,
  vertical_attrs,
  is_stock_tracked,
  shop_id,
  is_active
) ON TABLE public.products TO anon;

REVOKE ALL PRIVILEGES ON TABLE public.inventory FROM anon;
GRANT SELECT (
  quantity_in_stock,
  product_id
) ON TABLE public.inventory TO anon;

CREATE OR REPLACE FUNCTION public.get_public_receipt(p_invoice_id uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'invoice_number', i.invoice_number,
    'invoice_date', i.invoice_date,
    'document_type', i.document_type,
    'customer_name', i.customer_name,
    'customer_phone', i.customer_phone,
    'customer_gstin', i.customer_gstin,
    'subtotal_paise', i.subtotal_paise,
    'cgst_total_paise', i.cgst_total_paise,
    'sgst_total_paise', i.sgst_total_paise,
    'igst_total_paise', i.igst_total_paise,
    'discount_paise', i.discount_paise,
    'round_off_paise', i.round_off_paise,
    'total_paise', i.total_paise,
    'payment_mode', i.payment_mode,
    'is_inter_state', i.is_inter_state,
    'created_at', i.created_at,
    'points_earned', loyalty.points,
    'points_balance', loyalty.running_balance,
    'shop', jsonb_build_object(
      'business_name', s.business_name,
      'gstin', s.gstin,
      'gst_type', s.gst_type,
      'address_line_1', s.address_line_1,
      'city', s.city,
      'state_code', s.state_code,
      'phone', s.phone
    ),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_name', ii.product_name,
          'hsn_code', ii.hsn_code,
          'quantity', ii.quantity,
          'unit', ii.unit,
          'unit_price_paise', ii.unit_price_paise,
          'gst_rate_percent', ii.gst_rate_percent,
          'cgst_paise', ii.cgst_paise,
          'sgst_paise', ii.sgst_paise,
          'igst_paise', ii.igst_paise,
          'total_paise', ii.total_paise
        ) ORDER BY ii.created_at
      )
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
        AND ii.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.invoices i
  JOIN public.shops s ON s.id = i.shop_id
  LEFT JOIN LATERAL (
    SELECT
      ll.points,
      ll.running_balance
    FROM public.loyalty_ledger ll
    WHERE i.customer_id IS NOT NULL
      AND ll.invoice_id = i.id
      AND ll.shop_id = i.shop_id
      AND ll.customer_id = i.customer_id
      AND ll.entry_type = 'earn'
      AND ll.deleted_at IS NULL
    ORDER BY ll.created_at, ll.id
    LIMIT 1
  ) AS loyalty ON true
  WHERE i.id = p_invoice_id
    AND i.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_public_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(uuid) TO anon, authenticated;

COMMIT;
