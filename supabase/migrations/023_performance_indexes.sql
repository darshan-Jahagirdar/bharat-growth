-- =========================================================================
-- Migration 023: Performance Indexes
-- Optimizes storefront inventory joins, POS drawer queries, and
-- invoice item lookups that became hot paths in Phase 26.
-- =========================================================================

-- 1. Storefront product → inventory join
--    StorefrontLoader.tsx fetches products with inventory(quantity_in_stock).
--    The FK on (shop_id, product_id) is covered by the composite index
--    idx_inventory_shop_product (migration 007), but a standalone product_id
--    index lets Postgres use an index-only scan when joining without shop_id
--    filtering (e.g., save_invoice V2's per-item tracked-product lookup).
CREATE INDEX IF NOT EXISTS idx_inventory_product_id
  ON inventory (product_id);

-- 2. POS Online Orders Drawer + badge poll
--    OnlineOrdersDrawer fetches: WHERE shop_id = ? AND status = 'pending_online'
--    Badge poll: SELECT count(*) WHERE shop_id = ? AND status = 'pending_online'
--    Without this, Postgres seq-scans the entire invoices table per poll.
CREATE INDEX IF NOT EXISTS idx_invoices_shop_status
  ON invoices (shop_id, status);

-- 3. Invoice items batch fetch
--    OnlineOrdersDrawer uses: .in('invoice_id', invoiceIds)
--    save_invoice V2 doesn't need this (items are inserted, not queried),
--    but receipt loading and GST export also filter by invoice_id.
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items (invoice_id);
