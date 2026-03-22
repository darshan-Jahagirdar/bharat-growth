// =============================================================================
// BharatGrowth — Dashboard Supabase Queries (Client-Side)
// All queries filter by shop_id for RLS compliance
// =============================================================================

import { createClient } from '@/lib/supabase/client';

export interface DashboardMetrics {
  todaySalesPaise: number;
  totalInvoicesToday: number;
  loyaltyPointsIssuedToday: number;
  gstCollectedTodayPaise: number;
}

export interface RecentTransaction {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  total_paise: number;
  payment_mode: string;
  created_at: string;
  item_count: number;
}

// ── Singleton client ──
let supabase: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!supabase) supabase = createClient();
  return supabase;
}

// ── Get today's date range in IST ──
function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const yyyy = istNow.getUTCFullYear();
  const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istNow.getUTCDate()).padStart(2, '0');
  const todayIST = `${yyyy}-${mm}-${dd}`;
  return {
    start: `${todayIST}T00:00:00+05:30`,
    end: `${todayIST}T23:59:59+05:30`,
  };
}

// ── Fetch Dashboard Metrics ──
export async function fetchDashboardMetrics(
  shopId: string
): Promise<DashboardMetrics> {
  const client = getClient();
  const { start, end } = getTodayRange();

  // Today's invoices (completed only)
  const { data: invoices } = await client
    .from('invoices')
    .select('total_paise, cgst_total_paise, sgst_total_paise, igst_total_paise')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', start)
    .lte('created_at', end);

  const todaySalesPaise = (invoices ?? []).reduce(
    (sum, inv) => sum + (inv.total_paise ?? 0),
    0
  );
  const totalInvoicesToday = (invoices ?? []).length;
  const gstCollectedTodayPaise = (invoices ?? []).reduce(
    (sum, inv) =>
      sum +
      (inv.cgst_total_paise ?? 0) +
      (inv.sgst_total_paise ?? 0) +
      (inv.igst_total_paise ?? 0),
    0
  );

  // Today's loyalty points issued
  const { data: loyalty } = await client
    .from('loyalty_ledger')
    .select('points')
    .eq('shop_id', shopId)
    .eq('entry_type', 'earn')
    .gte('created_at', start)
    .lte('created_at', end);

  const loyaltyPointsIssuedToday = (loyalty ?? []).reduce(
    (sum, entry) => sum + (entry.points ?? 0),
    0
  );

  return {
    todaySalesPaise,
    totalInvoicesToday,
    loyaltyPointsIssuedToday,
    gstCollectedTodayPaise,
  };
}

// ── Fetch Recent Transactions ──
export async function fetchRecentTransactions(
  shopId: string,
  limit = 10
): Promise<RecentTransaction[]> {
  const client = getClient();

  const { data: invoices } = await client
    .from('invoices')
    .select('id, invoice_number, customer_name, total_paise, payment_mode, created_at')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!invoices || invoices.length === 0) return [];

  // Get item counts for each invoice
  const invoiceIds = invoices.map((inv) => inv.id);
  const { data: items } = await client
    .from('invoice_items')
    .select('invoice_id')
    .in('invoice_id', invoiceIds);

  const countMap: Record<string, number> = {};
  (items ?? []).forEach((item) => {
    countMap[item.invoice_id] = (countMap[item.invoice_id] ?? 0) + 1;
  });

  return invoices.map((inv) => ({
    ...inv,
    item_count: countMap[inv.id] ?? 0,
  }));
}
