// =============================================================================
// BharatGrowth — Supabase Server Client (Server Components / Route Handlers)
// =============================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import dns from 'node:dns';

// Force IPv4 DNS — fixes Windows Node.js undici UND_ERR_CONNECT_TIMEOUT
dns.setDefaultResultOrder('ipv4first');

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — can't set cookies, safe to ignore
          }
        },
      },
    }
  );
}
