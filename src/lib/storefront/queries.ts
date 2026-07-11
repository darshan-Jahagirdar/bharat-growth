// =============================================================================
// BharatGrowth — Storefront Public Data Queries (Server-Side)
// Fetches ONLY public-safe data: shop info, products, owner phone
// Never exposes: financials, customer data, invoices, loyalty ledger
// =============================================================================

import { createPublicClient } from '@/lib/supabase/public';
import type { BusinessType, ThemePreference, ProductUnit, GstRatePercent, VerticalAttrs } from '@/lib/types/database';

// ── Public-safe shop profile ──

export interface StorefrontShop {
  id: string;
  business_name: string;
  business_type: BusinessType;
  city: string | null;
  state_code: string;
  logo_url: string | null;
  theme_preference: ThemePreference;
  primary_color: string;
  owner_phone: string | null; // For WhatsApp "Buy" button
}

// ── Public-safe product card ──

export interface StorefrontProduct {
  id: string;
  name: string;
  sku: string | null;
  hsn_code: string;
  selling_price_paise: number;
  gst_rate_percent: GstRatePercent;
  unit: ProductUnit;
  category: string | null;
  image_url: string | null;
  vertical_attrs: VerticalAttrs;
  is_stock_tracked: boolean;
  stock_quantity: number | null; // null = untracked (infinite)
}

// ── Fetch shop profile + owner phone ──

export async function getStorefrontShop(
  shopId: string
): Promise<StorefrontShop | null> {
  const client = createPublicClient();

  // Fetch shop (public columns only)
  // theme_preference & primary_color may not exist yet if migration 012 hasn't run
  const { data: shop, error: shopErr } = await client
    .from('shops')
    .select(
      'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color'
    )
    .eq('id', shopId)
    .single();

  if (shopErr) {
    console.error('[Storefront] Shop query error:', shopErr.message, shopErr.code);
    return null;
  }
  if (!shop) return null;

  // Security-definer RPC exposes one safe field without granting anonymous
  // users blanket SELECT access to the users table.
  const { data: ownerPhone, error: ownerErr } = await client.rpc(
    'get_storefront_owner_phone',
    { p_shop_id: shopId }
  );

  if (ownerErr) {
    console.warn('[Storefront] Owner phone query failed (non-fatal):', ownerErr.message);
  }

  return {
    id: shop.id,
    business_name: shop.business_name,
    business_type: shop.business_type as BusinessType,
    city: shop.city ?? null,
    state_code: shop.state_code,
    logo_url: shop.logo_url ?? null,
    theme_preference: (shop.theme_preference ?? 'modern') as ThemePreference,
    primary_color: shop.primary_color ?? '#2563EB',
    owner_phone: typeof ownerPhone === 'string' ? ownerPhone : null,
  };
}

// ── Fetch active products for catalog ──

export async function getStorefrontProducts(
  shopId: string
): Promise<StorefrontProduct[]> {
  const client = createPublicClient();

  const { data, error } = await client
    .from('products')
    .select(
      'id, name, sku, hsn_code, selling_price_paise, gst_rate_percent, unit, category, image_url, vertical_attrs, is_stock_tracked, inventory(quantity_in_stock)'
    )
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('category', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('[Storefront] Products query error:', error.message, error.code);
    return [];
  }

  return (data ?? []).map((p) => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      hsn_code: p.hsn_code,
      selling_price_paise: p.selling_price_paise,
      gst_rate_percent: p.gst_rate_percent as GstRatePercent,
      unit: p.unit as ProductUnit,
      category: p.category,
      image_url: p.image_url,
      vertical_attrs: p.vertical_attrs as VerticalAttrs,
      is_stock_tracked: p.is_stock_tracked ?? false,
      stock_quantity: p.is_stock_tracked && inv
        ? Number((inv as { quantity_in_stock: number }).quantity_in_stock)
        : null,
    };
  });
}
