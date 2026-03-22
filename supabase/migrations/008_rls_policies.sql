-- =========================================================================
-- Migration 008: Row-Level Security Policies
-- Pattern: (SELECT get_current_shop_id()) — InitPlan optimization
-- Postgres evaluates the subquery ONCE per statement, not per-row
-- =========================================================================

-- Enable + Force RLS on ALL tables
ALTER TABLE shops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE shops               FORCE ROW LEVEL SECURITY;
ALTER TABLE users               FORCE ROW LEVEL SECURITY;
ALTER TABLE products            FORCE ROW LEVEL SECURITY;
ALTER TABLE customers           FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices            FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_items       FORCE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ledger      FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_logs        FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory           FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;

-- ── SHOPS ──
CREATE POLICY shops_select ON shops
  FOR SELECT USING (id = (SELECT get_current_shop_id()));
CREATE POLICY shops_update ON shops
  FOR UPDATE USING (id = (SELECT get_current_shop_id()))
  WITH CHECK (id = (SELECT get_current_shop_id()));

-- ── USERS ──
CREATE POLICY users_select ON users
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY users_update ON users
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── PRODUCTS ──
CREATE POLICY products_select ON products
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY products_insert ON products
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY products_update ON products
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY products_delete ON products
  FOR DELETE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('owner','manager'))
  );

-- ── CUSTOMERS ──
CREATE POLICY customers_select ON customers
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY customers_insert ON customers
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY customers_update ON customers
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVOICES ──
CREATE POLICY invoices_select ON invoices
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY invoices_insert ON invoices
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY invoices_update ON invoices
  FOR UPDATE USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'owner')
  );

-- ── INVOICE ITEMS ──
CREATE POLICY invoice_items_select ON invoice_items
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY invoice_items_insert ON invoice_items
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── LOYALTY LEDGER ──
CREATE POLICY loyalty_select ON loyalty_ledger
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY loyalty_insert ON loyalty_ledger
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── CONSENT LOGS (append-only: owner reads, all roles insert) ──
CREATE POLICY consent_logs_select ON consent_logs
  FOR SELECT USING (
    shop_id = (SELECT get_current_shop_id())
    AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'owner')
  );
CREATE POLICY consent_logs_insert ON consent_logs
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVENTORY ──
CREATE POLICY inventory_select ON inventory
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY inventory_insert ON inventory
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY inventory_update ON inventory
  FOR UPDATE USING (shop_id = (SELECT get_current_shop_id()))
  WITH CHECK (shop_id = (SELECT get_current_shop_id()));

-- ── INVENTORY MOVEMENTS ──
CREATE POLICY inv_movements_select ON inventory_movements
  FOR SELECT USING (shop_id = (SELECT get_current_shop_id()));
CREATE POLICY inv_movements_insert ON inventory_movements
  FOR INSERT WITH CHECK (shop_id = (SELECT get_current_shop_id()));
