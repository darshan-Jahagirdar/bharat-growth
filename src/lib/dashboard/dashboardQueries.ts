// =============================================================================
// BharatGrowth — Dashboard Supabase Queries (Client-Side)
// Phase 17: Analytics Command Center + Phase 20: GST Export
// All queries filter by shop_id for RLS compliance
// =============================================================================

import { createClient } from '@/lib/supabase/client';

// ── Types ──

export interface DashboardKPIs {
  todayRevenuePaise: number;
  totalUdhaarPaise: number;
  billsToday: number;
  inventoryValuePaise: number;
  monthlySalesPaise: number;
  monthlyPurchasesPaise: number;
  stockValueCostPaise: number;
}

export interface RevenueTrendPoint {
  date: string;      // 'Mon', 'Tue', etc.
  fullDate: string;  // '28 Mar'
  revenue: number;   // in rupees (for chart display)
}

export interface TopProduct {
  name: string;
  sales: number;   // in rupees
}

export interface CreditCustomer {
  id: string;
  name: string | null;
  phone_number: string;
  photo_url: string | null;
  credit_balance_paise: number;
  last_visit_at: string | null;
}

export interface LowStockProduct {
  id: string;
  name: string;
  quantity_in_stock: number;
  unit: string;
  reorder_level: number | null;
}

export interface NegativeStockProduct {
  product_id: string;
  inventory_id: string;
  name: string;
  quantity_in_stock: number;
  unit: string;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  revenueTrend: RevenueTrendPoint[];
  topProducts: TopProduct[];
  khataCustomers: CreditCustomer[];
  lowStockProducts: LowStockProduct[];
  negativeStockProducts: NegativeStockProduct[];
}

// ── Singleton client ──
let supabase: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!supabase) supabase = createClient();
  return supabase;
}

// ── IST date helpers ──

function getISTDate(offsetDays = 0): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCDate(istNow.getUTCDate() + offsetDays);
  return istNow;
}

function formatISTDateISO(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayRange(): { start: string; end: string } {
  const todayIST = formatISTDateISO(getISTDate());
  return {
    start: `${todayIST}T00:00:00+05:30`,
    end: `${todayIST}T23:59:59+05:30`,
  };
}

function getDateRange(daysBack: number): { start: string; end: string } {
  const startDate = formatISTDateISO(getISTDate(-daysBack));
  const endDate = formatISTDateISO(getISTDate());
  return {
    start: `${startDate}T00:00:00+05:30`,
    end: `${endDate}T23:59:59+05:30`,
  };
}

// ── Get first day of current month in IST ──
function getMonthStart(): string {
  const ist = getISTDate();
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01T00:00:00+05:30`;
}

// ── Date range type for dashboard filters ──

export interface DateRange {
  start: string; // ISO timestamp with +05:30 offset
  end: string;
}

// ── Fetch all dashboard data in parallel ──

export async function fetchAllDashboardData(
  shopId: string,
  dateRange?: DateRange
): Promise<DashboardData> {
  const [kpis, revenueTrend, topProducts, khataCustomers, lowStockProducts, negativeStockProducts] =
    await Promise.all([
      fetchKPIs(shopId, dateRange),
      fetchRevenueTrend(shopId),
      fetchTopProducts(shopId),
      fetchKhataCustomers(shopId),
      fetchLowStockProducts(shopId),
      fetchNegativeStockProducts(shopId),
    ]);

  return { kpis, revenueTrend, topProducts, khataCustomers, lowStockProducts, negativeStockProducts };
}

// ── KPIs ──

async function fetchKPIs(shopId: string, dateRange?: DateRange): Promise<DashboardKPIs> {
  const client = getClient();
  const { start, end } = getTodayRange();

  // Date range for Sales/Purchases: custom range or default to this month
  const rangeStart = dateRange?.start ?? getMonthStart();
  const rangeEnd = dateRange?.end; // undefined = no upper bound (up to now)

  // Run all KPI queries in parallel
  // Build sales query
  let salesQuery = client
    .from('invoices')
    .select('total_paise')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', rangeStart);
  if (rangeEnd) salesQuery = salesQuery.lte('created_at', rangeEnd);

  // Build purchases query
  let purchasesQuery = client
    .from('inventory_movements')
    .select('total_value_paise')
    .eq('shop_id', shopId)
    .eq('movement_type', 'purchase')
    .gte('created_at', rangeStart);
  if (rangeEnd) purchasesQuery = purchasesQuery.lte('created_at', rangeEnd);

  const [invoicesResult, creditResult, inventoryResult, monthlySalesResult, monthlyPurchasesResult, stockCostResult] = await Promise.all([
    // Today's invoices (always today, not affected by date filter)
    client
      .from('invoices')
      .select('total_paise')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end),

    // Total udhaar (snapshot, not affected by date filter)
    client
      .from('customers')
      .select('credit_balance_paise')
      .eq('shop_id', shopId)
      .gt('credit_balance_paise', 0),

    // Inventory value at selling price (snapshot, not affected by date filter)
    client
      .from('inventory')
      .select('quantity_in_stock, products!inner(selling_price_paise)')
      .eq('shop_id', shopId)
      .gt('quantity_in_stock', 0),

    // Sales in selected range
    salesQuery,

    // Purchases in selected range
    purchasesQuery,

    // Stock value at cost (snapshot, not affected by date filter)
    client
      .from('inventory')
      .select('quantity_in_stock, products!inner(purchase_price_paise)')
      .eq('shop_id', shopId)
      .gt('quantity_in_stock', 0),
  ]);

  const invoices = invoicesResult.data ?? [];
  const todayRevenuePaise = invoices.reduce(
    (sum, inv) => sum + (inv.total_paise ?? 0),
    0
  );
  const billsToday = invoices.length;

  const creditRows = creditResult.data ?? [];
  const totalUdhaarPaise = creditRows.reduce(
    (sum, c) => sum + (c.credit_balance_paise ?? 0),
    0
  );

  const inventoryRows = inventoryResult.data ?? [];
  const inventoryValuePaise = inventoryRows.reduce((sum, row) => {
    const product = row.products as unknown as { selling_price_paise: number };
    const price = product?.selling_price_paise ?? 0;
    const qty = row.quantity_in_stock ?? 0;
    return sum + price * qty;
  }, 0);

  // Monthly sales
  const monthlySalesRows = monthlySalesResult.data ?? [];
  const monthlySalesPaise = monthlySalesRows.reduce(
    (sum, inv) => sum + (inv.total_paise ?? 0),
    0
  );

  // Monthly purchases
  const monthlyPurchasesRows = monthlyPurchasesResult.data ?? [];
  const monthlyPurchasesPaise = monthlyPurchasesRows.reduce(
    (sum, mov) => sum + (mov.total_value_paise ?? 0),
    0
  );

  // Stock value at cost
  const stockCostRows = stockCostResult.data ?? [];
  const stockValueCostPaise = stockCostRows.reduce((sum, row) => {
    const product = row.products as unknown as { purchase_price_paise: number | null };
    const price = product?.purchase_price_paise ?? 0;
    const qty = row.quantity_in_stock ?? 0;
    return sum + price * qty;
  }, 0);

  return {
    todayRevenuePaise,
    totalUdhaarPaise,
    billsToday,
    inventoryValuePaise,
    monthlySalesPaise,
    monthlyPurchasesPaise,
    stockValueCostPaise,
  };
}

// ── 7-Day Revenue Trend ──

async function fetchRevenueTrend(
  shopId: string
): Promise<RevenueTrendPoint[]> {
  const client = getClient();
  const { start, end } = getDateRange(6); // 6 days back + today = 7 days

  const { data: invoices } = await client
    .from('invoices')
    .select('total_paise, created_at')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', start)
    .lte('created_at', end);

  // Group by IST date
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets: Record<string, number> = {};

  // Initialize all 7 days
  for (let i = -6; i <= 0; i++) {
    const d = getISTDate(i);
    const key = formatISTDateISO(d);
    buckets[key] = 0;
  }

  // Fill with actual data
  for (const inv of invoices ?? []) {
    const d = new Date(inv.created_at);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    const key = formatISTDateISO(istDate);
    if (key in buckets) {
      buckets[key] += inv.total_paise ?? 0;
    }
  }

  // Convert to array
  return Object.entries(buckets).map(([dateStr, paise]) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return {
      date: dayNames[d.getUTCDay()],
      fullDate: `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`,
      revenue: Math.round(paise / 100), // paise → rupees for chart
    };
  });
}

// ── Top 5 Products This Month ──

async function fetchTopProducts(shopId: string): Promise<TopProduct[]> {
  const client = getClient();
  const monthStart = getMonthStart();

  const { data: items } = await client
    .from('invoice_items')
    .select('product_name, taxable_amount_paise, invoices!inner(status, created_at)')
    .eq('shop_id', shopId)
    .gte('invoices.created_at', monthStart);

  if (!items || items.length === 0) return [];

  // Aggregate by product name
  const productMap: Record<string, number> = {};
  for (const item of items) {
    const invoice = item.invoices as unknown as { status: string };
    if (invoice?.status !== 'completed') continue;
    const name = item.product_name;
    productMap[name] = (productMap[name] ?? 0) + (item.taxable_amount_paise ?? 0);
  }

  // Sort and take top 5
  return Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, paise]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '...' : name,
      sales: Math.round(paise / 100), // paise → rupees
    }));
}

// ── Khata Customers ──

export async function fetchKhataCustomers(
  shopId: string,
  limit = 50
): Promise<CreditCustomer[]> {
  const client = getClient();

  const { data, error } = await client
    .from('customers')
    .select('id, name, phone_number, photo_url, credit_balance_paise, last_visit_at')
    .eq('shop_id', shopId)
    .gt('credit_balance_paise', 0)
    .order('credit_balance_paise', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Dashboard] Khata query error:', error.message);
    return [];
  }

  return (data ?? []) as CreditCustomer[];
}

// ── Low Stock Products ──

async function fetchLowStockProducts(
  shopId: string,
  threshold = 10,
  limit = 50
): Promise<LowStockProduct[]> {
  const client = getClient();

  const { data, error } = await client
    .from('inventory')
    .select('id, quantity_in_stock, reorder_level, products!inner(id, name, unit, is_active)')
    .eq('shop_id', shopId)
    .lt('quantity_in_stock', threshold)
    .order('quantity_in_stock', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Dashboard] Low stock query error:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const product = row.products as unknown as { is_active: boolean };
      return product?.is_active !== false;
    })
    .map((row) => {
      const product = row.products as unknown as {
        id: string;
        name: string;
        unit: string;
      };
      return {
        id: product.id,
        name: product.name,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: product.unit,
        reorder_level: row.reorder_level ? Number(row.reorder_level) : null,
      };
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 26: Negative Stock (Anomaly) Detection
// ══════════════════════════════════════════════════════════════════════════════

async function fetchNegativeStockProducts(
  shopId: string
): Promise<NegativeStockProduct[]> {
  const client = getClient();

  const { data, error } = await client
    .from('inventory')
    .select('id, product_id, quantity_in_stock, products!inner(name, unit, is_stock_tracked)')
    .eq('shop_id', shopId)
    .lt('quantity_in_stock', 0)
    .order('quantity_in_stock', { ascending: true });

  if (error) {
    console.error('[Dashboard] Negative stock query error:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const product = row.products as unknown as { is_stock_tracked: boolean };
      return product?.is_stock_tracked === true;
    })
    .map((row) => {
      const product = row.products as unknown as { name: string; unit: string };
      return {
        product_id: row.product_id,
        inventory_id: row.id,
        name: product.name,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: product.unit,
      };
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 20: "CA Pleaser" GST Export
// ══════════════════════════════════════════════════════════════════════════════

export interface GstReportRow {
  'Invoice No': string;
  'Invoice Date': string;
  'Customer Name': string;
  'Customer Phone': string;
  'Buyer GSTIN': string;
  'HSN/SAC': string;
  'Taxable Value (₹)': string;
  'CGST (₹)': string;
  'SGST (₹)': string;
  'IGST (₹)': string;
  'Invoice Total (₹)': string;
  'Payment Mode': string;
}

/**
 * Fetch current month's completed invoices with line-item detail
 * and format them as a flat array ready for CSV export.
 */
export async function exportGstReport(shopId: string): Promise<GstReportRow[]> {
  const client = getClient();
  const monthStart = getMonthStart();
  const ist = getISTDate();
  const monthEnd = `${formatISTDateISO(ist)}T23:59:59+05:30`;

  // Fetch invoices with their items and customer info
  const { data: invoices, error } = await client
    .from('invoices')
    .select(`
      id,
      invoice_number,
      created_at,
      total_paise,
      payment_mode,
      customer_gstin,
      customers ( name, phone_number ),
      invoice_items (
        product_name,
        hsn_code,
        quantity,
        taxable_amount_paise,
        cgst_paise,
        sgst_paise,
        igst_paise,
        total_paise
      )
    `)
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GST Export] Query error:', error.message);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  if (!invoices || invoices.length === 0) return [];

  const rows: GstReportRow[] = [];

  for (const inv of invoices) {
    const customer = inv.customers as unknown as {
      name: string | null;
      phone_number: string;
    } | null;

    const items = (inv.invoice_items ?? []) as unknown as Array<{
      product_name: string;
      hsn_code: string | null;
      quantity: number;
      taxable_amount_paise: number;
      cgst_paise: number;
      sgst_paise: number;
      igst_paise: number;
      total_paise: number;
    }>;

    // Format date as DD/MM/YYYY in IST
    const createdAt = new Date(inv.created_at);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(createdAt.getTime() + istOffset);
    const invoiceDate = `${String(istDate.getUTCDate()).padStart(2, '0')}/${String(istDate.getUTCMonth() + 1).padStart(2, '0')}/${istDate.getUTCFullYear()}`;

    if (items.length === 0) {
      // Invoice with no line items — still export it as a single row
      rows.push({
        'Invoice No': inv.invoice_number ?? inv.id.slice(0, 8),
        'Invoice Date': invoiceDate,
        'Customer Name': customer?.name ?? 'Walk-in',
        'Customer Phone': customer?.phone_number ?? '',
        'Buyer GSTIN': inv.customer_gstin ?? '',
        'HSN/SAC': '',
        'Taxable Value (₹)': paiseToRupeeStr(inv.total_paise ?? 0),
        'CGST (₹)': '0.00',
        'SGST (₹)': '0.00',
        'IGST (₹)': '0.00',
        'Invoice Total (₹)': paiseToRupeeStr(inv.total_paise ?? 0),
        'Payment Mode': inv.payment_mode ?? 'cash',
      });
    } else {
      // One row per line item for proper HSN-wise breakup
      for (const item of items) {
        rows.push({
          'Invoice No': inv.invoice_number ?? inv.id.slice(0, 8),
          'Invoice Date': invoiceDate,
          'Customer Name': customer?.name ?? 'Walk-in',
          'Customer Phone': customer?.phone_number ?? '',
          'Buyer GSTIN': inv.customer_gstin ?? '',
          'HSN/SAC': item.hsn_code ?? '',
          'Taxable Value (₹)': paiseToRupeeStr(item.taxable_amount_paise ?? 0),
          'CGST (₹)': paiseToRupeeStr(item.cgst_paise ?? 0),
          'SGST (₹)': paiseToRupeeStr(item.sgst_paise ?? 0),
          'IGST (₹)': paiseToRupeeStr(item.igst_paise ?? 0),
          'Invoice Total (₹)': paiseToRupeeStr(item.total_paise ?? 0),
          'Payment Mode': inv.payment_mode ?? 'cash',
        });
      }
    }
  }

  return rows;
}

/** Convert paise integer to "1234.56" rupee string with 2 decimal places */
function paiseToRupeeStr(paise: number): string {
  return (paise / 100).toFixed(2);
}
