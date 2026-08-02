import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function requireShopPageAccess(nextPath: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Unable to verify shop access');
  }

  if (!profile?.shop_id) {
    redirect('/onboarding');
  }

  return profile.shop_id;
}
