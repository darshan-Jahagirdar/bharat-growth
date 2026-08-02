// =============================================================================
// BharatGrowth — Dashboard Query Compatibility Facade
// =============================================================================

export { exportGstReport } from './dashboardGstQueries';
export { fetchAllDashboardData } from './dashboardOrchestrationQueries';
export { fetchCaptureMetrics } from './dashboardCaptureQueries';
export { fetchRetentionStats } from './dashboardRetentionQueries';
export { fetchKhataCustomers } from './dashboardStockQueries';
export type {
  CaptureMetrics,
  CreditCustomer,
  DashboardData,
  DashboardKPIs,
  DateRange,
  GstReportRow,
  LowStockProduct,
  NegativeStockProduct,
  RetentionRuleStats,
  RetentionStats,
  RevenueTrendPoint,
  TopProduct,
} from './dashboardQueryTypes';
