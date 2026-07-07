'use client';

// =============================================================================
// BharatGrowth — Online Orders Drawer (Phase 25)
// Right-side slide-out panel showing pending storefront orders
// Shopkeeper can Accept & Print or Reject each order
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/types/database';

// ── Types ──

interface OrderItem {
  id: string;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price_paise: number;
  total_paise: number;
  gst_rate_percent: number;
  product_id: string | null;
}

interface OnlineOrder {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  delivery_address: string | null;
  total_paise: number;
  payment_mode: string;
  created_at: string;
  notes: string | null;
  items: OrderItem[];
}

interface OnlineOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  onAccepted: (invoiceId: string) => void;
  onCountChange: (count: number) => void;
}

// ── Component ──

export function OnlineOrdersDrawer({
  isOpen,
  onClose,
  shopId,
  onAccepted,
  onCountChange,
}: OnlineOrdersDrawerProps) {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ── Fetch pending online orders ──
  const fetchOrders = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError('');

    const supabase = createClient();

    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, customer_phone, customer_id, delivery_address, total_paise, payment_mode, created_at, notes')
      .eq('shop_id', shopId)
      .eq('status', 'pending_online')
      .order('created_at', { ascending: true });

    if (invErr) {
      console.error('[OnlineOrders] Fetch failed:', invErr.message);
      setError(`Failed to load orders: ${invErr.message}`);
      setLoading(false);
      return;
    }

    if (!invoices || invoices.length === 0) {
      setOrders([]);
      onCountChange(0);
      setLoading(false);
      return;
    }

    // Fetch items for all pending invoices in one query
    const invoiceIds = invoices.map((inv) => inv.id);
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, product_id, product_name, hsn_code, quantity, unit, unit_price_paise, total_paise, gst_rate_percent')
      .in('invoice_id', invoiceIds);

    if (itemsErr) {
      console.error('[OnlineOrders] Items fetch failed:', itemsErr.message);
    }

    const itemsByInvoice = new Map<string, OrderItem[]>();
    for (const item of items ?? []) {
      const key = (item as { invoice_id: string }).invoice_id;
      if (!itemsByInvoice.has(key)) itemsByInvoice.set(key, []);
      itemsByInvoice.get(key)!.push({
        id: item.id,
        product_name: item.product_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_paise: item.unit_price_paise,
        total_paise: item.total_paise,
        gst_rate_percent: item.gst_rate_percent,
        product_id: item.product_id,
      });
    }

    const merged: OnlineOrder[] = invoices.map((inv) => ({
      ...inv,
      items: itemsByInvoice.get(inv.id) ?? [],
    }));

    setOrders(merged);
    onCountChange(merged.length);
    setLoading(false);
  }, [shopId, onCountChange]);

  useEffect(() => {
    if (isOpen) fetchOrders();
  }, [isOpen, fetchOrders]);

  // ── Accept & Print ──
  const handleAccept = async (order: OnlineOrder) => {
    setActionLoading(order.id);
    const supabase = createClient();

    const { error: acceptErr } = await supabase.rpc('accept_online_order', {
      p_invoice_id: order.id,
      p_shop_id: shopId,
    });

    if (acceptErr) {
      console.error('[OnlineOrders] Accept failed:', acceptErr.message);
      setError(`Failed to accept order: ${acceptErr.message}`);
      setActionLoading(null);
      return;
    }

    // Send digital receipt via WhatsApp (non-blocking app-side effect)
    if (order.customer_phone) {
      fetch('/api/whatsapp/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: order.id,
        }),
      }).catch(() => {});
    }

    setActionLoading(null);

    // Remove from local list
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== order.id);
      onCountChange(next.length);
      return next;
    });

    // Trigger print via parent
    onAccepted(order.id);

    if (orders.length <= 1) onClose();
  };

  // ── Reject ──
  const handleReject = async (order: OnlineOrder) => {
    setActionLoading(order.id);
    const supabase = createClient();

    const { error: rejectErr } = await supabase.rpc('reject_online_order', {
      p_invoice_id: order.id,
      p_shop_id: shopId,
    });

    if (rejectErr) {
      console.error('[OnlineOrders] Reject failed:', rejectErr.message);
      setError(`Failed to reject order: ${rejectErr.message}`);
      setActionLoading(null);
      return;
    }

    setActionLoading(null);

    // Remove from local list
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== order.id);
      onCountChange(next.length);
      return next;
    });

    if (orders.length <= 1) onClose();
  };

  // ── Time ago helper ──
  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ── Render ──
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-gray-950 border-l border-gray-800 z-50
                    transform transition-transform duration-300 ease-in-out flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-sm font-bold">Online Orders</h2>
              <p className="text-gray-500 text-[10px]">{orders.length} pending</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Order List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && orders.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              <div className="w-5 h-5 border-2 border-gray-700 border-t-orange-400 rounded-full animate-spin mr-3" />
              Loading orders...
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <svg className="w-12 h-12 mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm font-medium">No pending orders</p>
              <p className="text-xs mt-1">New storefront orders will appear here</p>
            </div>
          )}

          {orders.map((order) => {
            const isProcessing = actionLoading === order.id;
            const isKhata = order.payment_mode === 'online_khata';

            return (
              <div
                key={order.id}
                className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-opacity ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Card Header */}
                <div className="px-4 pt-3 pb-2 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-semibold truncate">
                        {order.customer_name || 'Guest'}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        isKhata
                          ? 'bg-red-900/50 text-red-400 border border-red-800/50'
                          : 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/50'
                      }`}>
                        {isKhata ? 'KHATA' : 'UPI'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      {order.customer_phone && (
                        <span>{order.customer_phone}</span>
                      )}
                      <span>{timeAgo(order.created_at)}</span>
                      <span className="text-gray-700">{order.invoice_number}</span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <span className="text-white text-base font-bold">
                      {formatINR(order.total_paise)}
                    </span>
                  </div>
                </div>

                {/* Delivery Address */}
                {order.delivery_address && (
                  <div className="px-4 pb-2">
                    <div className="flex items-start gap-1.5 text-[11px] text-yellow-500/80 bg-yellow-900/10 border border-yellow-900/20 rounded-lg px-2.5 py-1.5">
                      <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{order.delivery_address}</span>
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div className="px-4 pb-2">
                  <div className="bg-gray-950 rounded-lg border border-gray-800/50 divide-y divide-gray-800/50">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="bg-gray-800 text-gray-400 text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="text-gray-300 text-xs truncate">
                            {item.product_name}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs font-medium ml-2 flex-shrink-0">
                          {formatINR(item.total_paise)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 pb-3 flex gap-2">
                  <button
                    onClick={() => handleReject(order)}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold border border-gray-700 text-gray-400
                               hover:bg-red-900/20 hover:border-red-800/50 hover:text-red-400 transition-all"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleAccept(order)}
                    disabled={isProcessing}
                    className="flex-[2] py-2.5 rounded-lg text-xs font-bold bg-emerald-600 text-white
                               hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Accept &amp; Print
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
