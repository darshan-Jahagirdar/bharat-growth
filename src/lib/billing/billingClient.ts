import { createClient } from '@/lib/supabase/client';

let supabase: ReturnType<typeof createClient> | null = null;

export function getBillingClient() {
  if (!supabase) supabase = createClient();
  return supabase;
}
