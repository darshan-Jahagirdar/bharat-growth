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
  date: string;
  fullDate: string;
  revenue: number;
}

export interface TopProduct {
  name: string;
  sales: number;
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

export interface RetentionRuleStats {
  ruleId: string;
  ruleName: string;
  tagName: string;
  isActive: boolean;
  sent: number;
  returned: number;
  revenuePaise: number;
}

export interface RetentionStats {
  messagesSent: number;
  customersReturned: number;
  revenueAttributedPaise: number;
  activeRulesCount: number;
  perRule: RetentionRuleStats[];
}

export interface CaptureMetrics {
  billsWithCustomerPercent: number | null;
  customerCaptures: number;
  identifiedBills: number;
  totalBills: number;
  visits: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  revenueTrend: RevenueTrendPoint[];
  topProducts: TopProduct[];
  khataCustomers: CreditCustomer[];
  lowStockProducts: LowStockProduct[];
  negativeStockProducts: NegativeStockProduct[];
  retentionStats: RetentionStats;
  captureMetrics: CaptureMetrics;
}

export interface DateRange {
  start: string;
  end: string;
}

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
