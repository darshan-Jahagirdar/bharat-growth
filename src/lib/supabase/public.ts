// =============================================================================
// BharatGrowth — Supabase Public Client (Server-Side, No Auth)
// Uses the anon key — for public-facing pages like /store/[shop_id]
// Relies on RLS public-read policies, NOT service role bypass
// =============================================================================

import { createClient } from '@supabase/supabase-js';

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `[PublicClient] Missing env vars — URL: ${url ? 'set' : 'MISSING'}, KEY: ${key ? 'set' : 'MISSING'}`
    );
  }

  return createClient(url, key, {
    global: {
      fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
