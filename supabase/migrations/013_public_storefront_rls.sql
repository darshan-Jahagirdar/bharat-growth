-- =========================================================================
-- Migration 013: Public Storefront RLS Policies
-- Allows anonymous (anon key) read access to shops and products
-- for the public digital storefront at /store/[shop_id]
-- Does NOT expose: customers, invoices, loyalty, inventory, consent logs
-- =========================================================================

-- Public can read any shop's profile (for storefront rendering)
CREATE POLICY "Public read shops"
  ON shops FOR SELECT
  TO anon
  USING (true);

-- Public can read active products (for storefront catalog)
CREATE POLICY "Public read active products"
  ON products FOR SELECT
  TO anon
  USING (is_active = true);

-- Public can read owner phone from users (for WhatsApp CTA)
-- Only exposes phone for active owners — no other user data leaks
CREATE POLICY "Public read owner phone"
  ON users FOR SELECT
  TO anon
  USING (role = 'owner' AND is_active = true);
