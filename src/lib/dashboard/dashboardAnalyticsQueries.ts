import { getDashboardClient } from './dashboardClient';
import {
  formatISTDateISO,
  getDateRange,
  getISTDate,
  getMonthStart,
} from './dashboardDateRanges';
import type { RevenueTrendPoint, TopProduct } from './dashboardQueryTypes';

export async function fetchRevenueTrend(
  shopId: string
): Promise<RevenueTrendPoint[]> {
  const client = getDashboardClient();
  const { start, end } = getDateRange(6);

  const { data: invoices } = await client
    .from('invoices')
    .select('total_paise, created_at')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', start)
    .lte('created_at', end);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets: Record<string, number> = {};

  for (let i = -6; i <= 0; i++) {
    const d = getISTDate(i);
    const key = formatISTDateISO(d);
    buckets[key] = 0;
  }

  for (const inv of invoices ?? []) {
    const d = new Date(inv.created_at);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    const key = formatISTDateISO(istDate);
    if (key in buckets) {
      buckets[key] += inv.total_paise ?? 0;
    }
  }

  return Object.entries(buckets).map(([dateStr, paise]) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return {
      date: dayNames[d.getUTCDay()],
      fullDate: `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`,
      revenue: Math.round(paise / 100),
    };
  });
}

export async function fetchTopProducts(shopId: string): Promise<TopProduct[]> {
  const client = getDashboardClient();
  const monthStart = getMonthStart();

  const { data: items } = await client
    .from('invoice_items')
    .select('product_name, taxable_amount_paise, invoices!inner(status, created_at)')
    .eq('shop_id', shopId)
    .gte('invoices.created_at', monthStart);

  if (!items || items.length === 0) return [];

  const productMap: Record<string, number> = {};
  for (const item of items) {
    const invoice = item.invoices as unknown as { status: string };
    if (invoice?.status !== 'completed') continue;
    const name = item.product_name;
    productMap[name] = (productMap[name] ?? 0) + (item.taxable_amount_paise ?? 0);
  }

  return Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, paise]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '...' : name,
      sales: Math.round(paise / 100),
    }));
}
