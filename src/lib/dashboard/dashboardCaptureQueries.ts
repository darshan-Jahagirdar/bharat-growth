import { getDashboardClient } from './dashboardClient';
import { getMonthStart } from './dashboardDateRanges';
import type { CaptureMetrics, DateRange } from './dashboardQueryTypes';

export async function fetchCaptureMetrics(
  shopId: string,
  dateRange?: DateRange
): Promise<CaptureMetrics> {
  const client = getDashboardClient();
  const start = dateRange?.start ?? getMonthStart();
  const end = dateRange?.end;

  let invoicesQuery = client
    .from('invoices')
    .select('customer_id')
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', start);
  if (end) invoicesQuery = invoicesQuery.lte('created_at', end);

  let visitsQuery = client
    .from('customer_visits')
    .select('id')
    .eq('shop_id', shopId)
    .gte('created_at', start);
  if (end) visitsQuery = visitsQuery.lte('created_at', end);

  const [invoicesResult, visitsResult] = await Promise.all([
    invoicesQuery,
    visitsQuery,
  ]);

  if (invoicesResult.error) {
    console.warn(
      '[Dashboard] Capture invoice query failed:',
      invoicesResult.error.message
    );
  }
  if (visitsResult.error) {
    console.warn(
      '[Dashboard] Capture visit query failed:',
      visitsResult.error.message
    );
  }

  const invoices = invoicesResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const identifiedBills = invoices.filter((invoice) =>
    Boolean(invoice.customer_id)
  ).length;
  const totalBills = invoices.length;

  return {
    billsWithCustomerPercent:
      totalBills === 0
        ? null
        : Math.round((identifiedBills / totalBills) * 100),
    customerCaptures: identifiedBills + visits.length,
    identifiedBills,
    totalBills,
    visits: visits.length,
  };
}
