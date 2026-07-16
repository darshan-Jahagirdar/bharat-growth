import { createClient } from '@/lib/supabase/client';

let supabase: ReturnType<typeof createClient> | null = null;

export function getDashboardClient() {
  if (!supabase) supabase = createClient();
  return supabase;
}
