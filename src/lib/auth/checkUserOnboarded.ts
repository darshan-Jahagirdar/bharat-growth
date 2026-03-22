// =============================================================================
// BharatGrowth — Check if authenticated user has completed onboarding
// Returns shop context if onboarded, null if new user
// =============================================================================

import { createClient } from '@/lib/supabase/client';

export interface UserShopContext {
  userId: string;
  shopId: string;
  shopName: string;
  role: string;
  gstType: string;
  stateCode: string;
}

export async function checkUserOnboarded(
  userId: string
): Promise<UserShopContext | null> {
  const supabase = createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, shop_id, role, shops!inner(id, business_name, gst_type, state_code)')
    .eq('id', userId)
    .single();

  if (error || !user) return null;

  const shop = Array.isArray(user.shops) ? user.shops[0] : user.shops;

  return {
    userId: user.id,
    shopId: user.shop_id,
    shopName: (shop as { business_name: string }).business_name,
    role: user.role,
    gstType: (shop as { gst_type: string }).gst_type,
    stateCode: (shop as { state_code: string }).state_code,
  };
}
