import {
  FileText,
  IndianRupee,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
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
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-orange-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Today&apos;s Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.todayRevenuePaise)}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-500">
            <TrendingUp className="w-3 h-3" />
            Live
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-red-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Total Udhaar
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.totalUdhaarPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-red-400/70">
            {data.khataCustomers.length} customer{data.khataCustomers.length !== 1 ? 's' : ''} owe
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-blue-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Bills Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {data.kpis.billsToday}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            Completed invoices
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-emerald-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Inventory Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.inventoryValuePaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            At selling price
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-teal-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Sales ({periodLabel})
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-teal-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.monthlySalesPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            Completed invoices
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-violet-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Purchases ({periodLabel})
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
            {formatINR(data.kpis.monthlyPurchasesPaise)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">Stock in</div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-amber-500/20 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Current Stock Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Warehouse className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-100 tracking-tight">
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
