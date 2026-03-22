'use client';

// =============================================================================
// BharatGrowth — Owner's Dashboard (Mobile-First, Client Component)
// Fetches data via browser Supabase client
// =============================================================================

import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/types/database';
import {
  fetchDashboardMetrics,
  fetchRecentTransactions,
  type DashboardMetrics,
  type RecentTransaction,
} from '@/lib/dashboard/dashboardQueries';

// TODO: Get from auth context when auth is wired
const SHOP_ID = 'a0000000-0000-0000-0000-000000000001';

const PAYMENT_ICONS: Record<string, string> = {
  cash: '₹',
  upi: '⚡',
  card: '💳',
  credit: '📝',
  split: '🔀',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, t] = await Promise.all([
        fetchDashboardMetrics(SHOP_ID),
        fetchRecentTransactions(SHOP_ID),
      ]);
      setMetrics(m);
      setTransactions(t);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-orange-500">BharatGrowth</h1>
            <p className="text-xs text-gray-400">Owner Dashboard</p>
          </div>
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
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ── Loading State ── */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm mt-3">Loading dashboard...</div>
          </div>
        )}

        {/* ── Metric Cards (2x2 grid) ── */}
        {metrics && (
          <div className="grid grid-cols-2 gap-3">
            {/* Today's Sales */}
            <div className="bg-gradient-to-br from-orange-950/60 to-orange-900/30 border border-orange-800/40 rounded-xl p-4">
              <div className="text-xs text-orange-400/80 font-medium mb-1">
                Today&apos;s Sales
              </div>
              <div className="text-xl font-bold text-orange-300 tracking-tight">
                {formatINR(metrics.todaySalesPaise)}
              </div>
            </div>

            {/* Total Invoices */}
            <div className="bg-gradient-to-br from-blue-950/60 to-blue-900/30 border border-blue-800/40 rounded-xl p-4">
              <div className="text-xs text-blue-400/80 font-medium mb-1">
                Invoices
              </div>
              <div className="text-xl font-bold text-blue-300 tracking-tight">
                {metrics.totalInvoicesToday}
              </div>
              <div className="text-[10px] text-blue-500/70 mt-0.5">bills today</div>
            </div>

            {/* Loyalty Points */}
            <div className="bg-gradient-to-br from-purple-950/60 to-purple-900/30 border border-purple-800/40 rounded-xl p-4">
              <div className="text-xs text-purple-400/80 font-medium mb-1">
                Loyalty Points
              </div>
              <div className="text-xl font-bold text-purple-300 tracking-tight">
                {metrics.loyaltyPointsIssuedToday}
              </div>
              <div className="text-[10px] text-purple-500/70 mt-0.5">pts issued</div>
            </div>

            {/* GST Collected */}
            <div className="bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 border border-emerald-800/40 rounded-xl p-4">
              <div className="text-xs text-emerald-400/80 font-medium mb-1">
                GST Collected
              </div>
              <div className="text-xl font-bold text-emerald-300 tracking-tight">
                {formatINR(metrics.gstCollectedTodayPaise)}
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Transactions ── */}
        {!loading && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2 px-1">
              Recent Transactions
            </h2>

            {transactions.length === 0 ? (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-8 text-center">
                <div className="text-gray-600 text-sm">No transactions yet</div>
                <div className="text-gray-700 text-xs mt-1">
                  Bills created on /billing will appear here
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3
                               flex items-center justify-between hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Payment icon */}
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm shrink-0">
                        {PAYMENT_ICONS[tx.payment_mode] ?? '₹'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">
                          {tx.customer_name ?? 'Walk-in customer'}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2">
                          <span>{tx.invoice_number}</span>
                          <span>·</span>
                          <span>{tx.item_count} item{tx.item_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold text-gray-200">
                        {formatINR(tx.total_paise)}
                      </div>
                      <div className="text-[10px] text-gray-600">
                        {timeAgo(tx.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quick Link to Billing ── */}
        {!loading && (
          <a
            href="/billing"
            className="block w-full text-center py-3 rounded-xl bg-orange-600 hover:bg-orange-500
                       text-white font-semibold text-sm transition-colors"
          >
            Open Billing Counter
          </a>
        )}
      </main>
    </div>
  );
}
