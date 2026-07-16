import { createPublicClient } from '@/lib/supabase/public';
import type {
  GstRatePercent,
  ProductUnit,
  VerticalAttrs,
} from '@/lib/types/database';
import type { StorefrontProduct } from './storefrontQueryTypes';

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
