-- =========================================================================
-- Migration 003: Products catalog with GST tax slabs
-- =========================================================================

CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name                text NOT NULL,
  sku                 text,
  hsn_code            varchar(8) NOT NULL,
  gst_rate_percent    smallint NOT NULL CHECK (gst_rate_percent IN (0, 5, 12, 18, 28)),
  unit_price_paise    bigint NOT NULL CHECK (unit_price_paise >= 0),
  selling_price_paise bigint NOT NULL CHECK (selling_price_paise >= 0),
  unit                text NOT NULL DEFAULT 'piece' CHECK (
                        unit IN ('piece','kg','g','litre','ml','metre','set','pair','box')
                      ),
  category            text,
  is_active           boolean NOT NULL DEFAULT true,
  barcode             text,
  vertical_attrs      jsonb NOT NULL DEFAULT '{}',
  image_url           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_shop_name ON products (shop_id, name);
CREATE UNIQUE INDEX idx_products_shop_sku ON products (shop_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_products_shop_barcode ON products (shop_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_shop_hsn ON products (shop_id, hsn_code);
CREATE INDEX idx_products_shop_category ON products (shop_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_products_shop_active ON products (shop_id) WHERE is_active = true;
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
