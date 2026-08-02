import { createServerSupabaseClient } from '@/lib/supabase/server';

export type PlatformAdminIdentity =
  | { ok: true; userId: string; email: string }
  | {
      ok: false;
      reason: 'unauthenticated' | 'forbidden' | 'misconfigured';
    };

export async function getPlatformAdminIdentity(): Promise<PlatformAdminIdentity> {
  const configuredAdminEmail = process.env.PLATFORM_ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

  if (!configuredAdminEmail) {
    console.error('[Access admin] PLATFORM_ADMIN_EMAIL is not configured');
    return { ok: false, reason: 'misconfigured' };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail || userEmail !== configuredAdminEmail) {
    return { ok: false, reason: 'forbidden' };
  }

  return {
    ok: true,
    userId: user.id,
    email: userEmail,
  };
}
