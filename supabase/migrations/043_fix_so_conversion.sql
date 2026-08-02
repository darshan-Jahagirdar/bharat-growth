-- =========================================================================
-- Migration 043: Sales-order conversion money and GST correctness
--
-- Fixes fractional quantities being truncated before multiplication and makes
-- composition shops issue a bill of supply with zero GST.
-- =========================================================================

DO $$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('convert_so_to_invoice(uuid,text,uuid)'::regprocedure);
  v_def := replace(v_def, E'\r\n', E'\n');

  -- Add shop GST metadata to the function declaration.
  v_old := E'  v_state_code     character varying(2);';
  IF position(v_old IN v_def) = 0 THEN
    v_old := E'  v_state_code     varchar(2);';
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected state declaration not found in convert_so_to_invoice';
  END IF;
  v_new := v_old || E'\n  v_gst_type       text;\n  v_document_type  text;';
  v_def := replace(v_def, v_old, v_new);

  -- Fetch GST type with the shop state and select the legal document type.
  v_old := E'  SELECT COALESCE(s.state_code, ''27'')\n  INTO v_state_code\n  FROM shops s WHERE s.id = v_shop_id;';
  v_new := E'  SELECT COALESCE(s.state_code, ''27''), COALESCE(s.gst_type, ''regular'')\n  INTO v_state_code, v_gst_type\n  FROM shops s WHERE s.id = v_shop_id;\n\n  v_document_type := CASE\n    WHEN v_gst_type = ''composition'' THEN ''bill_of_supply''\n    ELSE ''tax_invoice''\n  END;';
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected shop-state query not found in convert_so_to_invoice';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  -- Header must match the shop's GST registration type.
  v_old := E'    ''tax_invoice'',\n    v_customer_id,';
  v_new := E'    v_document_type,\n    v_customer_id,';
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected invoice document type not found in convert_so_to_invoice';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  -- Multiply as numeric first, then round once to paise.
  v_old := '    v_taxable := v_item.agreed_price_paise * v_item.quantity::bigint;';
  v_new := '    v_taxable := ROUND(v_item.agreed_price_paise * v_item.quantity)::bigint;';
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected taxable calculation not found in convert_so_to_invoice';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  -- Composition dealers cannot collect GST or issue tax invoices.
  v_old := E'    v_gst_rate := v_product.gst_rate_percent;\n    v_total_gst := ROUND(v_taxable * v_gst_rate / 100.0)::bigint;\n    v_cgst := ROUND(v_total_gst / 2.0)::bigint;\n    v_sgst := v_total_gst - v_cgst;\n    v_item_total := v_taxable + v_cgst + v_sgst;';
  v_new := E'    IF v_gst_type = ''composition'' THEN\n      v_gst_rate := 0;\n      v_total_gst := 0;\n      v_cgst := 0;\n      v_sgst := 0;\n    ELSE\n      v_gst_rate := v_product.gst_rate_percent;\n      v_total_gst := ROUND(v_taxable * v_gst_rate / 100.0)::bigint;\n      v_cgst := ROUND(v_total_gst / 2.0)::bigint;\n      v_sgst := v_total_gst - v_cgst;\n    END IF;\n    v_item_total := v_taxable + v_cgst + v_sgst;';
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'Expected GST calculation block not found in convert_so_to_invoice';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  EXECUTE v_def;
END $$;
