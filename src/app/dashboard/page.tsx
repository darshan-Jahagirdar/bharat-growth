'use client';

// =============================================================================
// BharatGrowth — Analytics Command Center (Phase 17)
// 3-Row Premium Dashboard: KPIs → Charts → Action Items
// Desktop-optimized, glassmorphism dark theme
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { formatINR } from '@/lib/types/database';
import {
  fetchAllDashboardData,
  exportGstReport,
  type DashboardData,
  type DateRange,
  type CreditCustomer,
  type NegativeStockProduct,
} from '@/lib/dashboard/dashboardQueries';
import { downloadCSV } from '@/lib/utils/csvExport';
import TopNav from '@/components/layout/TopNav';
import Link from 'next/link';
import {
  ExternalLink,
  IndianRupee,
  FileText,
  Receipt,
  Package,
  AlertTriangle,
  TrendingUp,
  Download,
  Check,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ── Donut chart palette ──
const DONUT_COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fff7ed'];

// ── WhatsApp icon ──
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Custom tooltip for area chart ──
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-bold text-orange-400">
        {formatINR(payload[0].value * 100)}
      </p>
    </div>
  );
}

// ── Custom donut center label ──
function DonutCenter({ cx, cy, total }: { cx: number; cy: number; total: string }) {
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
        This Month
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-100 text-sm font-bold">
        {total}
      </text>
    </>
  );
}

export default function DashboardPage() {
  const [shopId, setShopId] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopNameState, setShopNameState] = useState('My Shop');
  const [shopUpiId, setShopUpiId] = useState<string | null>(null);

  // ── Khata reminder state ──
  const [reminderTarget, setReminderTarget] = useState<CreditCustomer | null>(null);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSuccess, setReminderSuccess] = useState<string | null>(null);

  // ── GST Export state ──
  const [gstExporting, setGstExporting] = useState(false);
  const [gstExportDone, setGstExportDone] = useState(false);

  // ── Anomaly reconciliation state ──
  const [resolveTarget, setResolveTarget] = useState<NegativeStockProduct | null>(null);
  const [resolveQty, setResolveQty] = useState('');
  const [resolving, setResolving] = useState(false);

  // ── Date range filter state ──
  type DatePreset = 'today' | '7d' | 'month' | 'custom';
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const buildDateRange = useCallback((): DateRange | undefined => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffset);
    const todayISO = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;

    switch (datePreset) {
      case 'today':
        return {
          start: `${todayISO}T00:00:00+05:30`,
          end: `${todayISO}T23:59:59+05:30`,
        };
      case '7d': {
        const weekAgo = new Date(istNow.getTime() - 6 * 24 * 60 * 60 * 1000);
        const startISO = `${weekAgo.getUTCFullYear()}-${String(weekAgo.getUTCMonth() + 1).padStart(2, '0')}-${String(weekAgo.getUTCDate()).padStart(2, '0')}`;
        return {
          start: `${startISO}T00:00:00+05:30`,
          end: `${todayISO}T23:59:59+05:30`,
        };
      }
      case 'month': {
        const mm = String(istNow.getUTCMonth() + 1).padStart(2, '0');
        return {
          start: `${istNow.getUTCFullYear()}-${mm}-01T00:00:00+05:30`,
          end: `${todayISO}T23:59:59+05:30`,
        };
      }
      case 'custom':
        if (customStart) {
          return {
            start: `${customStart}T00:00:00+05:30`,
            end: customEnd ? `${customEnd}T23:59:59+05:30` : `${todayISO}T23:59:59+05:30`,
          };
        }
        return undefined; // no filter
    }
  }, [datePreset, customStart, customEnd]);

  // ── Resolve shop from authenticated user ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) setShopId(ctx.shopId);
      });
    });
  }, []);

  // ── Load shop info once ──
  useEffect(() => {
    if (!shopId) return;
    async function loadShop() {
      const supabase = createClient();
      const { data: shop } = await supabase
        .from('shops')
        .select('business_name, upi_id')
        .eq('id', shopId)
        .single();
      if (shop) {
        setShopNameState(shop.business_name);
        setShopUpiId(shop.upi_id ?? null);
      }
    }
    loadShop();
  }, [shopId]);

  // ── Load dashboard data (re-fetches when shopId or date range changes) ──
  useEffect(() => {
    if (!shopId) return;
    async function load() {
      setLoading(true);
      const range = buildDateRange();
      const dashData = await fetchAllDashboardData(shopId, range);
      setData(dashData);
      setLoading(false);
    }
    load();
  }, [shopId, datePreset, customStart, customEnd, buildDateRange]);

  // ── Derived values ──
  const topProductTotal = data?.topProducts.reduce((s, p) => s + p.sales, 0) ?? 0;
  const periodLabel = datePreset === 'today' ? 'Today'
    : datePreset === '7d' ? 'Last 7 Days'
    : datePreset === 'month' ? 'This Month'
    : 'Custom Range';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-200">
              {shopNameState}
            </h1>
            <p className="text-xs text-gray-500">Analytics Command Center</p>
          </div>
          <div className="flex items-center gap-3">
            {shopId && (
              <>
                <button
                  onClick={async () => {
                    if (gstExporting) return;
                    setGstExporting(true);
                    setGstExportDone(false);
                    try {
                      const rows = await exportGstReport(shopId);
                      if (rows.length === 0) {
                        alert('No completed invoices this month to export.');
                        setGstExporting(false);
                        return;
                      }
                      // Generate filename: GST_Report_ShopName_Mar2026.csv
                      const now = new Date();
                      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const safeName = shopNameState.replace(/[^a-zA-Z0-9]/g, '_');
                      const filename = `GST_Report_${safeName}_${monthNames[now.getMonth()]}${now.getFullYear()}.csv`;
                      downloadCSV(rows as unknown as Record<string, string | number>[], filename);
                      setGstExportDone(true);
                      setTimeout(() => setGstExportDone(false), 3000);
                    } catch (err) {
                      console.error('[GST Export] Error:', err);
                      alert('Failed to export GST report. Please try again.');
                    }
                    setGstExporting(false);
                  }}
                  disabled={gstExporting}
                  className={`border transition-colors rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium
                    ${gstExportDone
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                    } disabled:opacity-50`}
                >
                  {gstExporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      Exporting...
                    </>
                  ) : gstExportDone ? (
                    <>
                      <Check className="w-4 h-4" />
                      Downloaded!
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Tax Report
                    </>
                  )}
                </button>
                <Link
                  href={`/store/${shopId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-orange-500/30 text-orange-400 hover:bg-orange-500/10
                             transition-colors rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium"
                >
                  View Storefront
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </>
            )}
            <div className="text-right">
              <div className="text-xs text-gray-500">Today</div>
              <div className="text-sm font-medium text-gray-300">
                {new Date().toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Date Range Filter ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mr-1">
            Period
          </span>
          {([
            { key: 'today', label: 'Today' },
            { key: '7d', label: 'Last 7 Days' },
            { key: 'month', label: 'This Month' },
            { key: 'custom', label: 'Custom' },
          ] as const).map((preset) => (
            <button
              key={preset.key}
              onClick={() => setDatePreset(preset.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${datePreset === preset.key
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 border border-white/5 hover:border-white/10 hover:text-gray-300'
                }`}
            >
              {preset.label}
            </button>
          ))}

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300
                           focus:outline-none focus:border-orange-500/40"
              />
              <span className="text-gray-600 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300
                           focus:outline-none focus:border-orange-500/40"
              />
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm mt-3">Loading dashboard...</div>
          </div>
        )}

        {data && (
          <>
            {/* ═══════════════════════════════════════════════════════════════
                ROW 1: THE PULSE — 4 KPI Cards
            ═══════════════════════════════════════════════════════════════ */}
            {/* ── Row 1a: Daily Pulse (4 cards) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today's Revenue */}
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

              {/* Total Udhaar */}
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

              {/* Bills Today */}
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

              {/* Inventory Value (Selling Price) */}
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

            {/* ── Row 1b: Monthly & Asset KPIs (3 cards) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sales */}
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

              {/* Purchases */}
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
                <div className="mt-1.5 text-[11px] text-gray-500">
                  Stock in
                </div>
              </div>

              {/* Current Stock Value (at cost) */}
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

            {/* ═══════════════════════════════════════════════════════════════
                ROW 2: THE TRENDS — Revenue Chart + Top Products Donut
            ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 7-Day Revenue Trend */}
              <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-200">Revenue Trend</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">Last 7 days</p>
                  </div>
                </div>
                {data.revenueTrend.some((d) => d.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.revenueTrend}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                        }
                        width={45}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                        dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#f97316', stroke: '#1e293b', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
                    No revenue data for the last 7 days
                  </div>
                )}
              </div>

              {/* Top 5 Products Donut */}
              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-200">Top Products</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">This month by sales</p>
                </div>
                {data.topProducts.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={data.topProducts}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="sales"
                          stroke="none"
                        >
                          {data.topProducts.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [formatINR(Number(value) * 100), 'Sales']}
                          contentStyle={{
                            background: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          itemStyle={{ color: '#f97316' }}
                        />
                        {/* Custom center text using foreignObject workaround */}
                        <text x="50%" y="46%" textAnchor="middle" fill="#9ca3af" fontSize={10}>
                          This Month
                        </text>
                        <text x="50%" y="58%" textAnchor="middle" fill="#e5e7eb" fontSize={13} fontWeight="bold">
                          {formatINR(topProductTotal * 100)}
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="mt-3 space-y-1.5">
                      {data.topProducts.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                            />
                            <span className="text-gray-400 truncate">{p.name}</span>
                          </div>
                          <span className="text-gray-300 font-medium shrink-0 ml-2">
                            {formatINR(p.sales * 100)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
                    No sales this month
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                ANOMALY ALERT — Negative Stock Reconciliation (Phase 26)
            ═══════════════════════════════════════════════════════════════ */}
            {data.negativeStockProducts.length > 0 && (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-bold text-red-300">
                    Stock Anomalies ({data.negativeStockProducts.length})
                  </h2>
                  <span className="text-[10px] text-red-400/70 ml-1">Items sold past zero — needs reconciliation</span>
                </div>
                <div className="space-y-2">
                  {data.negativeStockProducts.map((item) => (
                    <div key={item.inventory_id}
                      className="flex items-center justify-between bg-red-950/40 border border-red-900/30 rounded-lg px-4 py-2.5">
                      <div>
                        <span className="text-sm text-gray-200 font-medium">{item.name}</span>
                        <span className="text-xs text-red-400 font-mono ml-2">
                          Stock: {item.quantity_in_stock} {item.unit}
                        </span>
                      </div>
                      <button
                        onClick={() => { setResolveTarget(item); setResolveQty(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-800/40 text-red-300
                                   hover:bg-red-700/50 transition-colors border border-red-800/50"
                      >
                        Log Missing Delivery
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ROW 3: ACTION ITEMS — Khata Hitlist + Low Stock Alerts
            ═══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Khata Hitlist ── */}
              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-200">Khata Hitlist</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {data.khataCustomers.length} customer{data.khataCustomers.length !== 1 ? 's' : ''} with credit
                    </p>
                  </div>
                  <FileText className="w-4 h-4 text-red-400/60" />
                </div>

                {data.khataCustomers.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-gray-600 text-sm">No outstanding credit</div>
                    <div className="text-gray-700 text-[11px] mt-1">
                      Credit invoices will appear here
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {data.khataCustomers.map((c) => (
                      <div
                        key={c.id}
                        className="bg-gray-900/60 border border-gray-800/50 rounded-lg px-3 py-2.5
                                   flex items-center justify-between hover:border-gray-700/60 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {c.photo_url ? (
                              <img
                                src={c.photo_url}
                                alt={c.name ?? 'Customer'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-500 text-xs font-bold">
                                {(c.name ?? c.phone_number).charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-200 truncate">
                              {c.name ?? c.phone_number}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {c.phone_number}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <div className="text-right">
                            <div className="text-xs font-bold text-red-400">
                              {formatINR(c.credit_balance_paise)}
                            </div>
                          </div>
                          <button
                            onClick={() => setReminderTarget(c)}
                            title={`Send WhatsApp reminder to ${c.name ?? c.phone_number}`}
                            className="w-7 h-7 rounded-full bg-emerald-900/40 border border-emerald-800/50
                                       flex items-center justify-center
                                       hover:bg-emerald-800/60 hover:border-emerald-700 transition-colors"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Low Stock Alerts ── */}
              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-200">Low Stock Alerts</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {data.lowStockProducts.length} product{data.lowStockProducts.length !== 1 ? 's' : ''} below threshold
                    </p>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-amber-400/60" />
                </div>

                {data.lowStockProducts.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-gray-600 text-sm">All stocked up</div>
                    <div className="text-gray-700 text-[11px] mt-1">
                      Products with stock &lt; 10 will appear here
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {data.lowStockProducts.map((p) => {
                      const isZero = p.quantity_in_stock <= 0;
                      return (
                        <div
                          key={p.id}
                          className={`bg-gray-900/60 border rounded-lg px-3 py-2.5
                                     flex items-center justify-between transition-colors
                                     ${isZero
                                       ? 'border-red-800/40 hover:border-red-700/50'
                                       : 'border-gray-800/50 hover:border-gray-700/60'
                                     }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-200 truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Unit: {p.unit}
                              {p.reorder_level !== null && (
                                <> &middot; Reorder at {p.reorder_level}</>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 ml-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold
                                ${isZero
                                  ? 'bg-red-500/15 text-red-400'
                                  : p.quantity_in_stock <= 3
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-yellow-500/10 text-yellow-400'
                                }`}
                            >
                              {isZero ? 'OUT' : p.quantity_in_stock} {!isZero && p.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Success Toast ── */}
        {reminderSuccess && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 border border-emerald-700 rounded-lg px-4 py-3 shadow-xl">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <WhatsAppIcon className="w-4 h-4" />
              {reminderSuccess}
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          KHATA REMINDER CONFIRMATION MODAL (Anti-Spam)
      ═════════════════════════════════════════════════════════════════ */}
      {reminderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReminderTarget(null)} />

          <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xs p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-900/50 border border-emerald-800
                             flex items-center justify-center">
                <WhatsAppIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-200">Send Reminder?</div>
                <div className="text-[11px] text-gray-500">via WhatsApp</div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-gray-800/50 rounded-lg px-3 py-3 mb-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Customer</span>
                <span className="text-gray-200 font-medium">
                  {reminderTarget.name ?? reminderTarget.phone_number}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Outstanding</span>
                <span className="text-red-400 font-bold">
                  {formatINR(reminderTarget.credit_balance_paise)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Phone</span>
                <span className="text-gray-300 font-mono text-xs">
                  {reminderTarget.phone_number}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setReminderSending(true);
                  try {
                    const res = await fetch('/api/whatsapp/send-khata-reminder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        phone_number: reminderTarget.phone_number,
                        customer_name: reminderTarget.name ?? 'Customer',
                        shop_name: shopNameState,
                        balance_paise: reminderTarget.credit_balance_paise,
                        upi_id: shopUpiId,
                      }),
                    });
                    const result = await res.json();
                    if (result.sent || result.simulated) {
                      setReminderSuccess(
                        `Reminder sent to ${reminderTarget.name ?? reminderTarget.phone_number}`
                      );
                      setTimeout(() => setReminderSuccess(null), 4000);
                    }
                  } catch {
                    // Silent fail — non-critical
                  }
                  setReminderSending(false);
                  setReminderTarget(null);
                }}
                disabled={reminderSending}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           text-white text-sm font-semibold rounded-lg transition-colors
                           flex items-center justify-center gap-2"
              >
                {reminderSending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="w-4 h-4" />
                    Send Reminder
                  </>
                )}
              </button>
              <button
                onClick={() => setReminderTarget(null)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                           text-sm rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliation Modal (Phase 26) ── */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResolveTarget(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-sm font-bold text-white mb-1">Log Missing Delivery</h3>
            <p className="text-xs text-gray-400 mb-1">{resolveTarget.name}</p>
            <p className="text-xs text-red-400 font-mono mb-4">
              Current stock: {resolveTarget.quantity_in_stock} {resolveTarget.unit}
            </p>
            <label className="block text-xs text-gray-500 mb-1">Actual quantity received from supplier</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={resolveQty}
              onChange={(e) => setResolveQty(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none mb-4"
              placeholder="e.g. 20"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                disabled={resolving || !resolveQty || parseFloat(resolveQty) <= 0}
                onClick={async () => {
                  const qty = parseFloat(resolveQty);
                  if (isNaN(qty) || qty <= 0) return;
                  setResolving(true);
                  const supabase = createClient();
                  await supabase.rpc('adjust_stock', {
                    p_shop_id: shopId,
                    p_product_id: resolveTarget.product_id,
                    p_quantity_change: qty,
                    p_movement_type: 'purchase',
                    p_notes: `Reconciliation: logged missing delivery of ${qty} ${resolveTarget.unit}`,
                    p_reference_id: null,
                    p_reference_type: 'manual',
                    p_allow_negative: true,
                  });
                  setResolving(false);
                  setResolveTarget(null);
                  // Refresh dashboard
                  const dashData = await fetchAllDashboardData(shopId);
                  setData(dashData);
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white
                           hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {resolving ? 'Saving...' : 'Resolve'}
              </button>
              <button
                onClick={() => setResolveTarget(null)}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                           text-sm rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom scrollbar styles (injected via dangerouslySetInnerHTML to avoid styled-jsx) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}} />
    </div>
  );
}
