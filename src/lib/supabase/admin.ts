// =============================================================================
// BharatGrowth — Supabase Admin Client (Service Role — server-side only)
// Bypasses RLS — use only in API routes / server actions
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';

// Force IPv4 DNS — fixes Windows Node.js undici UND_ERR_CONNECT_TIMEOUT
dns.setDefaultResultOrder('ipv4first');

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
