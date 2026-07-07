import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface JoinedShop {
  business_name: string;
  phone: string | null;
  upi_id: string | null;
}

interface UserProfileRow {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  shops: JoinedShop | JoinedShop[] | null;
}

export interface ShopUserContext {
  supabase: ServerSupabaseClient;
  userId: string;
  shopId: string;
  fullName: string;
  userPhone: string | null;
  shopName: string;
  shopPhone: string | null;
  upiId: string | null;
}

type RequireShopUserResult =
  | ({ ok: true } & ShopUserContext)
  | { ok: false; response: NextResponse };

function firstJoinedShop(value: JoinedShop | JoinedShop[] | null): JoinedShop | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function requireShopUser(): Promise<RequireShopUserResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, shop_id, full_name, phone, shops!inner(business_name, phone, upi_id)')
    .eq('id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  const profile = data as UserProfileRow | null;
  const shop = firstJoinedShop(profile?.shops ?? null);

  if (error || !profile || !shop) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Active shop user required' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    supabase,
    userId: profile.id,
    shopId: profile.shop_id,
    fullName: profile.full_name,
    userPhone: profile.phone,
    shopName: shop.business_name,
    shopPhone: shop.phone,
    upiId: shop.upi_id,
  };
}
