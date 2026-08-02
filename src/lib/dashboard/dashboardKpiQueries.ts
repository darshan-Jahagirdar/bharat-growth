import { getDashboardClient } from './dashboardClient';
import { getMonthStart, getTodayRange } from './dashboardDateRanges';
import type { DashboardKPIs, DateRange } from './dashboardQueryTypes';

export async function fetchKPIs(
  shopId: string,
  dateRange?: DateRange
): Promise<DashboardKPIs> {
  const client = getDashboardClient();
  const { start, end } = getTodayRange();

  const rangeStart = dateRange?.start ?? getMonthStart();
  const rangeEnd = dateRange?.end;

  let salesQuery = client
    .from('invoices')
    .select('total_paise')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', rangeStart);
  if (rangeEnd) salesQuery = salesQuery.lte('created_at', rangeEnd);

  let purchasesQuery = client
    .from('inventory_movements')
    .select('total_value_paise')
    .eq('shop_id', shopId)
    .eq('movement_type', 'purchase')
    .gte('created_at', rangeStart);
  if (rangeEnd) purchasesQuery = purchasesQuery.lte('created_at', rangeEnd);

  const [invoicesResult, creditResult, inventoryResult, monthlySalesResult, monthlyPurchasesResult, stockCostResult] = await Promise.all([
    client
      .from('invoices')
      .select('total_paise')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end),
    client
      .from('customers')
      .select('credit_balance_paise')
      .eq('shop_id', shopId)
      .gt('credit_balance_paise', 0),
    client
      .from('inventory')
      .select('quantity_in_stock, products!inner(selling_price_paise)')
      .eq('shop_id', shopId)
      .gt('quantity_in_stock', 0),
    salesQuery,
    purchasesQuery,
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

  const monthlySalesRows = monthlySalesResult.data ?? [];
  const monthlySalesPaise = monthlySalesRows.reduce(
    (sum, inv) => sum + (inv.total_paise ?? 0),
    0
  );

  const monthlyPurchasesRows = monthlyPurchasesResult.data ?? [];
  const monthlyPurchasesPaise = monthlyPurchasesRows.reduce(
    (sum, mov) => sum + (mov.total_value_paise ?? 0),
    0
  );

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
