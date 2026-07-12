-- =========================================================================
-- Migration 042: Additive public-access RPCs
--
-- EXPAND PHASE ONLY. The existing anonymous grants and policies intentionally
-- remain compatible until the application using these RPCs is deployed and
-- verified. A later contract migration will remove obsolete table access.
-- =========================================================================

CREATE OR REPLACE FUNCTION get_public_receipt(p_invoice_id uuid)
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
      FROM invoice_items ii
      WHERE ii.invoice_id = i.id
        AND ii.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM invoices i
  JOIN shops s ON s.id = i.shop_id
  WHERE i.id = p_invoice_id
    AND i.deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_public_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_receipt(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_storefront_owner_phone(p_shop_id uuid)
RETURNS text AS $$
  SELECT u.phone
  FROM users u
  WHERE u.shop_id = p_shop_id
    AND u.role = 'owner'
    AND u.is_active = true
  ORDER BY u.created_at
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_storefront_owner_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_storefront_owner_phone(uuid) TO anon, authenticated;
