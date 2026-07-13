'use client';

import { DashboardActionSections } from '@/components/dashboard/DashboardActionSections';
import { DashboardAnomalies } from '@/components/dashboard/DashboardAnomalies';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { DashboardDateFilter } from '@/components/dashboard/DashboardDateFilter';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { KhataReminderDialog } from '@/components/dashboard/KhataReminderDialog';
import { ReminderSuccessToast } from '@/components/dashboard/ReminderSuccessToast';
import { StockReconciliationDialog } from '@/components/dashboard/StockReconciliationDialog';
import TopNav from '@/components/layout/TopNav';
import {
  getDashboardPeriodLabel,
  getTopProductTotal,
} from '@/lib/dashboard/dashboardPresentation';
import { useDashboardData } from '@/lib/dashboard/useDashboardData';
import { useGstExport } from '@/lib/dashboard/useGstExport';
import { useKhataReminder } from '@/lib/dashboard/useKhataReminder';
import { useStockReconciliation } from '@/lib/dashboard/useStockReconciliation';

export default function DashboardPage() {
  const dashboard = useDashboardData();
  const gstExport = useGstExport({
    shopId: dashboard.shopId,
    shopName: dashboard.shopName,
  });
  const reminder = useKhataReminder();
  const reconciliation = useStockReconciliation({
    setData: dashboard.setData,
    shopId: dashboard.shopId,
  });
  const topProductTotal = getTopProductTotal(
    dashboard.data?.topProducts ?? []
  );
  const periodLabel = getDashboardPeriodLabel(dashboard.datePreset);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <DashboardHeader
          exportDone={gstExport.exportDone}
          exporting={gstExport.exporting}
          onExport={gstExport.handleExport}
          shopId={dashboard.shopId}
          shopName={dashboard.shopName}
        />

        <DashboardDateFilter
          customEnd={dashboard.customEnd}
          customStart={dashboard.customStart}
          datePreset={dashboard.datePreset}
          onCustomEndChange={dashboard.setCustomEnd}
          onCustomStartChange={dashboard.setCustomStart}
          onDatePresetChange={dashboard.setDatePreset}
        />

        {dashboard.loading && (
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm mt-3">Loading dashboard...</div>
          </div>
        )}

        {dashboard.data && (
          <>
            <DashboardMetrics
              data={dashboard.data}
              periodLabel={periodLabel}
            />
            <DashboardCharts
              revenueTrend={dashboard.data.revenueTrend}
              topProductTotal={topProductTotal}
              topProducts={dashboard.data.topProducts}
            />
            <DashboardAnomalies
              products={dashboard.data.negativeStockProducts}
              onResolve={reconciliation.openTarget}
            />
            <DashboardActionSections
              khataCustomers={dashboard.data.khataCustomers}
              lowStockProducts={dashboard.data.lowStockProducts}
              onReminder={reminder.setTarget}
            />
          </>
        )}

        <ReminderSuccessToast message={reminder.success} />
      </div>

      <KhataReminderDialog
        onClose={() => reminder.setTarget(null)}
        onSend={reminder.sendReminder}
        sending={reminder.sending}
        target={reminder.target}
      />

      <StockReconciliationDialog
        onClose={() => reconciliation.setTarget(null)}
        onQuantityChange={reconciliation.setQuantity}
        onResolve={reconciliation.resolve}
        quantity={reconciliation.quantity}
        resolving={reconciliation.resolving}
        target={reconciliation.target}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}} />
    </div>
  );
}
