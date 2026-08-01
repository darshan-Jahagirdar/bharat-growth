import {
  fetchRevenueTrend,
  fetchTopProducts,
} from './dashboardAnalyticsQueries';
import { fetchCaptureMetrics } from './dashboardCaptureQueries';
import { fetchKPIs } from './dashboardKpiQueries';
import { fetchRetentionStats } from './dashboardRetentionQueries';
import {
  fetchKhataCustomers,
  fetchLowStockProducts,
  fetchNegativeStockProducts,
} from './dashboardStockQueries';
import type { DashboardData, DateRange } from './dashboardQueryTypes';

export async function fetchAllDashboardData(
  shopId: string,
  dateRange?: DateRange
): Promise<DashboardData> {
  const [
    kpis,
    revenueTrend,
    topProducts,
    khataCustomers,
    lowStockProducts,
    negativeStockProducts,
    retentionStats,
    captureMetrics,
  ] = await Promise.all([
    fetchKPIs(shopId, dateRange),
    fetchRevenueTrend(shopId),
    fetchTopProducts(shopId),
    fetchKhataCustomers(shopId),
    fetchLowStockProducts(shopId),
    fetchNegativeStockProducts(shopId),
    fetchRetentionStats(shopId),
    fetchCaptureMetrics(shopId, dateRange),
  ]);

  return {
    kpis,
    revenueTrend,
    topProducts,
    khataCustomers,
    lowStockProducts,
    negativeStockProducts,
    retentionStats,
    captureMetrics,
  };
}
