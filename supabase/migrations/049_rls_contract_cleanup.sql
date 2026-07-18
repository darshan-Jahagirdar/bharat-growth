-- =========================================================================
-- Migration 049: Anonymous read-surface contract cleanup
--
-- Contracts the temporary table access retained after migration 042. Public
-- storefront and receipt behavior continues through constrained RPCs and the
-- exact storefront column allowlists below.
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'Public read invoice by id'
      AND cmd = 'SELECT'
      AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'migration 049 precondition failed: expected invoices anon policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoice_items'
      AND policyname = 'Public read invoice items by invoice_id'
      AND cmd = 'SELECT'
      AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'migration 049 precondition failed: expected invoice_items anon policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Public read owner phone'
      AND cmd = 'SELECT'
      AND 'anon' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'migration 049 precondition failed: expected users anon policy is missing';
  END IF;

  IF to_regprocedure('public.get_public_receipt(uuid)') IS NULL
     OR NOT has_function_privilege(
       'anon',
       'public.get_public_receipt(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'migration 049 precondition failed: public receipt RPC is missing or not anon-executable';
  END IF;

  IF to_regprocedure('public.get_storefront_owner_phone(uuid)') IS NULL
     OR NOT has_function_privilege(
       'anon',
       'public.get_storefront_owner_phone(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'migration 049 precondition failed: owner-phone RPC is missing or not anon-executable';
  END IF;
END $$;

DROP POLICY "Public read invoice by id" ON public.invoices;
DROP POLICY "Public read invoice items by invoice_id" ON public.invoice_items;
DROP POLICY "Public read owner phone" ON public.users;

REVOKE ALL PRIVILEGES ON TABLE public.invoices FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.invoice_items FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon;

REVOKE SELECT ON TABLE public.shops FROM anon;
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

REVOKE SELECT ON TABLE public.products FROM anon;
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

REVOKE SELECT ON TABLE public.inventory FROM anon;
GRANT SELECT (
  quantity_in_stock,
  product_id
) ON TABLE public.inventory TO anon;
