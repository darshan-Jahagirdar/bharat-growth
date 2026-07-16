import { createPublicClient } from '@/lib/supabase/public';
import type { BusinessType, ThemePreference } from '@/lib/types/database';
import type { StorefrontShop } from './storefrontQueryTypes';

export async function getStorefrontShop(
  shopId: string
): Promise<StorefrontShop | null> {
  const client = createPublicClient();

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
