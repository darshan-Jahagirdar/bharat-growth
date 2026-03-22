-- =========================================================================
-- Migration 007: Inventory + Inventory Movements
-- =========================================================================

CREATE TABLE inventory (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id         uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number       text,
  quantity_in_stock  numeric(10,3) NOT NULL DEFAULT 0,
  reorder_level      numeric(10,3),
  cost_price_paise   bigint,
  expiry_date        date,
  manufacturing_date date,
  location           text,
  supplier_name      text,
  supplier_phone     varchar(15),
  last_restocked_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_inventory_shop_product_batch ON inventory
  (shop_id, product_id, COALESCE(batch_number, '__no_batch__'));
CREATE INDEX idx_inventory_shop_product ON inventory (shop_id, product_id);
CREATE INDEX idx_inventory_expiry ON inventory (shop_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE TRIGGER set_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE inventory_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  inventory_id    uuid NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  movement_type   text NOT NULL CHECK (
                    movement_type IN ('sale','purchase','return','adjustment','damage','expired')
                  ),
  quantity_change  numeric(10,3) NOT NULL,
  quantity_after   numeric(10,3) NOT NULL,
  reference_id     uuid,
  reference_type   text CHECK (reference_type IN ('invoice','purchase_order','manual')),
  reason           text,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_movements_shop_inv ON inventory_movements (shop_id, inventory_id, created_at DESC);
CREATE INDEX idx_inv_movements_shop_type ON inventory_movements (shop_id, movement_type, created_at);
CREATE INDEX idx_inv_movements_ref ON inventory_movements (shop_id, reference_id) WHERE reference_id IS NOT NULL;
