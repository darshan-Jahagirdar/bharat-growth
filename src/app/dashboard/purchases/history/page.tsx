'use client';

// =============================================================================
// BharatGrowth — Purchase History (Phase 28)
// View historical purchase bills with expandable line-item detail
// =============================================================================

import { useState, useEffect, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { formatINR } from '@/lib/types/database';
import TopNav from '@/components/layout/TopNav';
import {
  ChevronDown,
  ChevronRight,
  Package,
  FileText,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ──

interface PurchaseBill {
  id: string;
  supplier_name: string;
  bill_number: string | null;
  bill_date: string;
  total_amount_paise: number;
  created_at: string;
  items_count?: number;
}

interface BillLineItem {
  id: string;
  quantity_change: number;
  total_value_paise: number;
  reason: string | null;
  products: { name: string; unit: string } | null;
}

export default function PurchaseHistoryPage() {
  const [shopId, setShopId] = useState('');
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, BillLineItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // ── Auth ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) setShopId(ctx.shopId);
      });
    });
  }, []);

  // ── Fetch bills ──
  useEffect(() => {
    if (!shopId) return;
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('purchase_bills')
        .select('id, supplier_name, bill_number, bill_date, total_amount_paise, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[PurchaseHistory] Query error:', error.message);
      }

      // Get item counts per bill
      const rawBills = data ?? [];
      const countMap: Record<string, number> = {};
      if (rawBills.length > 0) {
        const billIds = rawBills.map((b) => b.id);
        const { data: movements } = await supabase
          .from('inventory_movements')
          .select('purchase_bill_id')
          .in('purchase_bill_id', billIds)
          .eq('movement_type', 'purchase');

        for (const m of movements ?? []) {
          if (m.purchase_bill_id) {
            countMap[m.purchase_bill_id] = (countMap[m.purchase_bill_id] ?? 0) + 1;
          }
        }
      }

      setBills(rawBills.map((b) => ({
        ...b,
        items_count: countMap[b.id] ?? 0,
      })));
      setLoading(false);
    }
    load();
  }, [shopId]);

  // ── Toggle expand / load line items ──
  async function toggleExpand(billId: string) {
    if (expandedBill === billId) {
      setExpandedBill(null);
      return;
    }

    setExpandedBill(billId);

    // Already loaded
    if (lineItems[billId]) return;

    setLoadingItems(billId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('id, quantity_change, total_value_paise, reason, products:inventory!inner(products!inner(name, unit))')
      .eq('purchase_bill_id', billId)
      .eq('movement_type', 'purchase');

    if (error) {
      // Fallback: simpler query without nested join
      const { data: fallbackData } = await supabase
        .from('inventory_movements')
        .select('id, quantity_change, total_value_paise, reason')
        .eq('purchase_bill_id', billId)
        .eq('movement_type', 'purchase');

      setLineItems((prev) => ({
        ...prev,
        [billId]: (fallbackData ?? []).map((item) => ({
          ...item,
          products: null,
        })),
      }));
    } else {
      // Flatten the nested join
      const items: BillLineItem[] = (data ?? []).map((row) => {
        const inv = row.products as unknown as { products: { name: string; unit: string } } | null;
        return {
          id: row.id,
          quantity_change: row.quantity_change,
          total_value_paise: row.total_value_paise,
          reason: row.reason,
          products: inv?.products ?? null,
        };
      });
      setLineItems((prev) => ({ ...prev, [billId]: items }));
    }
    setLoadingItems(null);
  }

  // ── Format date as "09 Apr 2026" ──
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-200">Purchase History</h1>
            <p className="text-xs text-gray-500">All purchase bills recorded for your shop</p>
          </div>
          <Link
            href="/dashboard/purchases/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </Link>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-500 text-sm mt-3">Loading purchase history...</div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && bills.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No purchase bills recorded yet.</p>
            <p className="text-gray-600 text-xs mt-1">
              Record your first purchase bill to track inventory costs.
            </p>
          </div>
        )}

        {/* ── Bills table ── */}
        {!loading && bills.length > 0 && (
          <div className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3 w-8" />
                  <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">
                    Date
                  </th>
                  <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">
                    Supplier
                  </th>
                  <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">
                    Bill #
                  </th>
                  <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">
                    Items
                  </th>
                  <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-5 py-3">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const isExpanded = expandedBill === bill.id;
                  const items = lineItems[bill.id];
                  const isLoadingThis = loadingItems === bill.id;

                  return (
                    <Fragment key={bill.id}>
                      <tr
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => toggleExpand(bill.id)}
                      >
                        <td className="px-5 py-3.5">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-300">
                          {formatDate(bill.bill_date)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-200 font-medium">
                          {bill.supplier_name}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400">
                          {bill.bill_number || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-400">
                          {bill.items_count ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-gray-200">
                          {formatINR(bill.total_amount_paise)}
                        </td>
                      </tr>

                      {/* ── Expanded line items ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-950/50 px-5 py-4">
                            {isLoadingThis ? (
                              <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                                <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                Loading items...
                              </div>
                            ) : items && items.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                                  Items in this bill
                                </div>
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Package className="w-4 h-4 text-gray-600" />
                                      <div>
                                        <div className="text-sm text-gray-200">
                                          {item.products?.name ?? item.reason ?? 'Unknown product'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          Qty: {item.quantity_change}{' '}
                                          {item.products?.unit ?? ''}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-sm font-medium text-gray-300">
                                      {formatINR(item.total_value_paise)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-600 py-2">
                                No line items found for this bill.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
