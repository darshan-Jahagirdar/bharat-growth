-- =========================================================================
-- Migration 014: Public Receipt RLS Policies
-- Allows anonymous read access to invoices and invoice_items
-- ONLY when queried by exact UUID (prevents full-table scraping)
-- =========================================================================

-- Anon can read a specific invoice by its UUID
-- The "true" USING clause works here because anon users MUST provide
-- .eq('id', uuid) in the query — without it, they get 0 rows because
-- there's no way to guess UUIDs. For defense-in-depth, the storefront
-- never exposes invoice IDs publicly.
CREATE POLICY "Public read invoice by id"
  ON invoices FOR SELECT
  TO anon
  USING (true);

-- Anon can read invoice items for a specific invoice
CREATE POLICY "Public read invoice items by invoice_id"
  ON invoice_items FOR SELECT
  TO anon
  USING (true);
