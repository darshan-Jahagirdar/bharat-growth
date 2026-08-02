import {
  FileText,
  IndianRupee,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import { formatINR } from '@/lib/types/database';
import type { DashboardData } from '@/lib/dashboard/dashboardQueries';
import { RetentionRoiCard } from './RetentionRoiCard';

interface DashboardMetricsProps {
  campaignsApproved: boolean | null;
  data: DashboardData;
  periodLabel: string;
}

export function DashboardMetrics({
  campaignsApproved,
  data,
  periodLabel,
}: DashboardMetricsProps) {
  return (
    <>
      <RetentionRoiCard
        campaignsApproved={campaignsApproved}
        stats={data.retentionStats}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Today&apos;s Revenue
            </span>
            <IndianRupee className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.todayRevenuePaise)}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-money">
            <TrendingUp className="w-3 h-3" />
            Live
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 border-l-[3px] border-l-dues rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Total Udhaar
            </span>
            <FileText className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-dues tracking-tight">
            {formatINR(data.kpis.totalUdhaarPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-dues/70">
            {data.khataCustomers.length} customer{data.khataCustomers.length !== 1 ? 's' : ''} owe
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Bills Today
            </span>
            <Receipt className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {data.kpis.billsToday}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            Completed invoices
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Inventory Value
            </span>
            <Package className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.inventoryValuePaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            At selling price
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Customer captures
            </span>
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {data.captureMetrics.customerCaptures}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            {periodLabel}: {data.captureMetrics.identifiedBills} identified bill
            {data.captureMetrics.identifiedBills !== 1 ? 's' : ''} +{' '}
            {data.captureMetrics.visits} visit
            {data.captureMetrics.visits !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Bills with customer
            </span>
            <Receipt className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {data.captureMetrics.billsWithCustomerPercent === null
              ? '—'
              : `${data.captureMetrics.billsWithCustomerPercent}%`}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            {data.captureMetrics.totalBills === 0
              ? 'No bills'
              : `${data.captureMetrics.identifiedBills} identified, ${
                  data.captureMetrics.totalBills -
                  data.captureMetrics.identifiedBills
                } walk-in`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Sales ({periodLabel})
            </span>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.monthlySalesPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            Completed invoices
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Purchases ({periodLabel})
            </span>
            <ShoppingCart className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.monthlyPurchasesPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">Stock in</div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              Current Stock Value
            </span>
            <Warehouse className="h-4 w-4 text-gray-500" />
          </div>
          <div className="font-mono text-xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.stockValueCostPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            At purchase price
          </div>
        </div>
      </div>
    </>
  );
}
