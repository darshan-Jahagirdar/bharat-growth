'use client';

// =============================================================================
// BharatGrowth — Order Management Dashboard (Phase 29.3 → 29.7)
// Two-tab layout: Sales Orders (Reservations) | Purchase Orders (Suppliers)
// Convert orders to invoices/bills, cancel dead orders, share via WhatsApp
// =============================================================================

import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { formatINR } from '@/lib/types/database';
import {
  fetchSalesOrders,
  fetchPurchaseOrders,
  convertSalesOrder,
  convertPurchaseOrder,
  cancelSalesOrder,
  cancelPurchaseOrder,
  type SalesOrderRow,
  type PurchaseOrderRow,
} from '@/lib/orders/orderQueries';
import TopNav from '@/components/layout/TopNav';
import {
  ShoppingCart,
  Truck,
  ChevronDown,
  ChevronRight,
  Package,
  ArrowRightLeft,
  X,
  Check,
  AlertCircle,
  Clock,
  Ban,
  CheckCircle2,
  Send,
  Clipboard,
  User,
  MessageCircle,
  Trash2,
} from 'lucide-react';

// ── Status badge config ──

const SO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  reserved: { label: 'Reserved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const PO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clipboard className="w-3 h-3" />,
  reserved: <Clock className="w-3 h-3" />,
  sent: <Send className="w-3 h-3" />,
  fulfilled: <CheckCircle2 className="w-3 h-3" />,
  cancelled: <Ban className="w-3 h-3" />,
};

// ── Payment mode options for SO conversion ──
const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit', label: 'Credit (Udhaar)' },
  { value: 'card', label: 'Card' },
];

// ── WhatsApp helpers (Phase 29.6 — rich itemized messages) ──

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) return digits;
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function formatWADate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildSOWhatsAppUrl(
  so: SalesOrderRow,
  shopName: string,
  shopId: string
): string {
  const phone = so.customer_phone ? normalizePhone(so.customer_phone) : '';
  const total = formatINR(so.total_amount_paise);
  const name = so.customer_name ?? 'Customer';
  const date = formatWADate(so.created_at);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const storefrontUrl = `${origin}/store/${shopId}`;

  const itemLines = so.items
    .map((item) => {
      const pName = item.product_name ?? 'Item';
      const lineTotal = formatINR(
        item.agreed_price_paise * Math.round(item.quantity)
      );
      return `${pName} x ${item.quantity} = ${lineTotal}`;
    })
    .join('\n');

  const message = [
    `*RESERVATION CONFIRMED - ${shopName}*`,
    '',
    `Order No: ${so.so_number}`,
    `Customer: ${name}`,
    `Date: ${date}`,
    `-------------------`,
    itemLines,
    `-------------------`,
    `*Total: ${total}*`,
    '',
    `Thank you for choosing us! View our store: ${storefrontUrl}`,
  ].join('\n');

  const text = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

function buildPOWhatsAppUrl(
  po: PurchaseOrderRow,
  shopName: string
): string {
  const total = formatINR(po.total_amount_paise);
  const date = formatWADate(po.created_at);

  const itemLines = po.items
    .map((item) => {
      const pName = item.product_name ?? 'Item';
      return `${pName} x ${item.quantity}`;
    })
    .join('\n');

  const message = [
    `*PURCHASE ORDER - ${shopName}*`,
    '',
    `PO No: ${po.po_number}`,
    `Supplier: ${po.supplier_name}`,
    `Date: ${date}`,
    `-------------------`,
    itemLines,
    `-------------------`,
    `*Total Estimated: ${total}*`,
    '',
    `Please confirm the availability of these items.`,
  ].join('\n');

  const text = encodeURIComponent(message);
  return `https://wa.me/?text=${text}`;
}

export default function OrdersPage() {
  // ── State ──
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loadingSO, setLoadingSO] = useState(true);
  const [loadingPO, setLoadingPO] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // FIX #4: Pagination — "Load More" state
  const [soHasMore, setSOHasMore] = useState(false);
  const [poHasMore, setPOHasMore] = useState(false);
  const [loadingMoreSO, setLoadingMoreSO] = useState(false);
  const [loadingMorePO, setLoadingMorePO] = useState(false);

  // FIX #5: Lazy-fetch — PO only loads when tab is first activated
  const [poInitialized, setPOInitialized] = useState(false);

  // Conversion modal state
  const [convertModal, setConvertModal] = useState<{
    type: 'so' | 'po';
    orderId: string;
    orderNumber: string;
  } | null>(null);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [converting, setConverting] = useState(false);

  // Cancel in-flight tracking
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // ── Auth ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) {
          setShopId(ctx.shopId);
          setShopName(ctx.shopName);
        }
      });
    });
  }, []);

  // ── Show toast with auto-dismiss ──
  const showToast = useCallback(
    (message: string, type: 'success' | 'error') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  // ── Fetch Sales Orders (first page, resets list) ──
  const loadSalesOrders = useCallback(async () => {
    if (!shopId) return;
    setLoadingSO(true);
    const result = await fetchSalesOrders(shopId, 0);
    setSalesOrders(result.rows);
    setSOHasMore(result.hasMore);
    setLoadingSO(false);
  }, [shopId]);

  // ── Fetch Purchase Orders (first page, resets list) ──
  const loadPurchaseOrders = useCallback(async () => {
    if (!shopId) return;
    setLoadingPO(true);
    const result = await fetchPurchaseOrders(shopId, 0);
    setPurchaseOrders(result.rows);
    setPOHasMore(result.hasMore);
    setLoadingPO(false);
  }, [shopId]);

  // FIX #5: Load SO immediately (default tab). Reset PO flag on shop change.
  useEffect(() => {
    if (!shopId) return;
    loadSalesOrders();
    setPOInitialized(false);
  }, [shopId, loadSalesOrders]);

  // FIX #5: Lazy-load PO on first tab switch
  useEffect(() => {
    if (activeTab === 'purchase' && !poInitialized && shopId) {
      setPOInitialized(true);
      loadPurchaseOrders();
    }
  }, [activeTab, poInitialized, shopId, loadPurchaseOrders]);

  // FIX #4: Load More handlers (append next page to existing list)
  async function handleLoadMoreSO() {
    setLoadingMoreSO(true);
    const result = await fetchSalesOrders(shopId, salesOrders.length);
    setSalesOrders((prev) => [...prev, ...result.rows]);
    setSOHasMore(result.hasMore);
    setLoadingMoreSO(false);
  }

  async function handleLoadMorePO() {
    setLoadingMorePO(true);
    const result = await fetchPurchaseOrders(shopId, purchaseOrders.length);
    setPurchaseOrders((prev) => [...prev, ...result.rows]);
    setPOHasMore(result.hasMore);
    setLoadingMorePO(false);
  }

  // ── Handle conversion ──
  async function handleConvert() {
    if (!convertModal) return;
    setConverting(true);

    try {
      if (convertModal.type === 'so') {
        const result = await convertSalesOrder(convertModal.orderId, paymentMode);
        if (result.success) {
          const invoiceNumber = result.data?.invoice_number ?? '';
          showToast(
            `${convertModal.orderNumber} converted to Invoice ${invoiceNumber}`,
            'success'
          );
          await loadSalesOrders();
        } else {
          showToast(
            result.error ?? 'Failed to convert sales order',
            'error'
          );
        }
      } else {
        const result = await convertPurchaseOrder(convertModal.orderId);
        if (result.success) {
          showToast(
            `${convertModal.orderNumber} converted to Purchase Bill`,
            'success'
          );
          await loadPurchaseOrders();
        } else {
          showToast(
            result.error ?? 'Failed to convert purchase order',
            'error'
          );
        }
      }
    } catch {
      showToast('Unexpected error during conversion', 'error');
    }

    setConverting(false);
    setConvertModal(null);
    setPaymentMode('cash');
  }

  // ── Handle SO cancellation ──
  async function handleCancelSO(soId: string, soNumber: string) {
    if (!window.confirm(`Cancel ${soNumber}? This cannot be undone.`)) return;
    setCancellingId(soId);
    const result = await cancelSalesOrder(soId, shopId);
    setCancellingId(null);
    if (result.success) {
      showToast(`${soNumber} cancelled`, 'success');
      await loadSalesOrders();
    } else {
      showToast(result.error ?? 'Failed to cancel order', 'error');
    }
  }

  // ── Handle PO cancellation ──
  async function handleCancelPO(poId: string, poNumber: string) {
    if (!window.confirm(`Cancel ${poNumber}? This cannot be undone.`)) return;
    setCancellingId(poId);
    const result = await cancelPurchaseOrder(poId, shopId);
    setCancellingId(null);
    if (result.success) {
      showToast(`${poNumber} cancelled`, 'success');
      await loadPurchaseOrders();
    } else {
      showToast(result.error ?? 'Failed to cancel order', 'error');
    }
  }

  // ── Format date as "09 Apr 2026" ──
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // ── Is order actionable? ──
  function isActionable(status: string): boolean {
    return status !== 'fulfilled' && status !== 'cancelled';
  }

  // ── Counts ──
  const soActiveCount = salesOrders.filter((o) => isActionable(o.status)).length;
  const poActiveCount = purchaseOrders.filter((o) => isActionable(o.status)).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-lg font-bold text-gray-200">Order Management</h1>
          <p className="text-xs text-gray-500">
            Track sales reservations and supplier purchase orders. Convert to
            invoices or bills when ready.
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 bg-slate-900/50 border border-white/5 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('sales')}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'sales'
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }
            `}
          >
            <ShoppingCart className="w-4 h-4" />
            Sales Orders
            {soActiveCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400">
                {soActiveCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('purchase')}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'purchase'
                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }
            `}
          >
            <Truck className="w-4 h-4" />
            Purchase Orders
            {poActiveCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400">
                {poActiveCount}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* SALES ORDERS TAB */}
        {/* ══════════════════════════════════════════════════════ */}
        {activeTab === 'sales' && (
          <div>
            {/* Loading */}
            {loadingSO && (
              <div className="text-center py-20">
                <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-gray-500 text-sm mt-3">
                  Loading sales orders...
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingSO && salesOrders.length === 0 && (
              <div className="text-center py-20">
                <ShoppingCart className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No sales orders yet.
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Sales orders will appear here when created. Convert them to
                  invoices with one click.
                </p>
              </div>
            )}

            {/* SO table */}
            {!loadingSO && salesOrders.length > 0 && (
              <div className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="w-8 px-4 py-3" />
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        SO Number
                      </th>
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Customer
                      </th>
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Date
                      </th>
                      <th className="text-center text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Status
                      </th>
                      <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Items
                      </th>
                      <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Total
                      </th>
                      <th className="text-center text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrders.map((so) => {
                      const isExpanded = expandedOrder === so.id;
                      const cfg = SO_STATUS_CONFIG[so.status] ?? SO_STATUS_CONFIG.draft;
                      const actionable = isActionable(so.status);
                      const isCancelling = cancellingId === so.id;

                      return (
                        <Fragment key={so.id}>
                          <tr
                            className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                            onClick={() =>
                              setExpandedOrder(isExpanded ? null : so.id)
                            }
                          >
                            <td className="px-4 py-3.5">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-orange-400/90">
                                {so.so_number}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-gray-600" />
                                <div>
                                  <div className="text-gray-200 text-sm">
                                    {so.customer_name ?? 'Walk-in'}
                                  </div>
                                  {so.customer_phone && (
                                    <div className="text-gray-500 text-[11px]">
                                      {so.customer_phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-gray-300 text-sm">
                              {formatDate(so.created_at)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.color}`}
                              >
                                {STATUS_ICONS[so.status]}
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right text-gray-400">
                              {so.items.length}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-gray-200">
                              {formatINR(so.total_amount_paise)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* WhatsApp share — available for all non-cancelled */}
                                {so.status !== 'cancelled' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        buildSOWhatsAppUrl(so, shopName, shopId),
                                        '_blank'
                                      );
                                    }}
                                    title="Share on WhatsApp"
                                    className="p-1.5 rounded-lg text-green-400/70 hover:text-green-400
                                               hover:bg-green-500/10 transition-colors"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Convert — only for actionable */}
                                {actionable && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConvertModal({
                                        type: 'so',
                                        orderId: so.id,
                                        orderNumber: so.so_number,
                                      });
                                    }}
                                    title="Convert to Invoice"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                               bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                                               hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    Invoice
                                  </button>
                                )}

                                {/* Cancel — only for actionable */}
                                {actionable && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelSO(so.id, so.so_number);
                                    }}
                                    disabled={isCancelling}
                                    title="Cancel Order"
                                    className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400
                                               hover:bg-red-950/30 transition-colors
                                               disabled:opacity-50"
                                  >
                                    {isCancelling ? (
                                      <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}

                                {/* Cancelled — show dash */}
                                {so.status === 'cancelled' && (
                                  <span className="text-gray-600 text-xs">--</span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded line items */}
                          {isExpanded && so.items.length > 0 && (
                            <tr>
                              <td colSpan={8} className="bg-slate-950/50 px-4 py-4">
                                <div className="space-y-2">
                                  <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                                    Line Items
                                  </div>
                                  {so.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/5"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Package className="w-4 h-4 text-gray-600" />
                                        <div>
                                          <div className="text-sm text-gray-200">
                                            {item.product_name ?? 'Unknown product'}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Qty: {item.quantity}
                                            {item.product_unit ? ` ${item.product_unit}` : ''}{' '}
                                            @ {formatINR(item.agreed_price_paise)}/unit
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-sm font-medium text-gray-300">
                                        {formatINR(
                                          item.agreed_price_paise *
                                            Math.round(item.quantity)
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {so.notes && (
                                    <div className="px-4 py-2 text-xs text-gray-500 italic">
                                      Note: {so.notes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}

                          {isExpanded && so.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="bg-slate-950/50 px-4 py-4 text-xs text-gray-600"
                              >
                                No line items in this order.
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

            {/* FIX #4: Load More button for SO pagination */}
            {!loadingSO && soHasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMoreSO}
                  disabled={loadingMoreSO}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
                             text-gray-400 border border-white/5 hover:bg-white/5 hover:text-gray-300
                             transition-colors disabled:opacity-50"
                >
                  {loadingMoreSO ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Orders'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* PURCHASE ORDERS TAB */}
        {/* ══════════════════════════════════════════════════════ */}
        {activeTab === 'purchase' && (
          <div>
            {/* Loading */}
            {loadingPO && (
              <div className="text-center py-20">
                <div className="inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-gray-500 text-sm mt-3">
                  Loading purchase orders...
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingPO && purchaseOrders.length === 0 && (
              <div className="text-center py-20">
                <Truck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No purchase orders yet.
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Purchase orders will appear here when created. Convert them
                  to purchase bills to receive stock.
                </p>
              </div>
            )}

            {/* PO table */}
            {!loadingPO && purchaseOrders.length > 0 && (
              <div className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="w-8 px-4 py-3" />
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        PO Number
                      </th>
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Supplier
                      </th>
                      <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Expected Date
                      </th>
                      <th className="text-center text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Status
                      </th>
                      <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Items
                      </th>
                      <th className="text-right text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Total
                      </th>
                      <th className="text-center text-[11px] text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => {
                      const isExpanded = expandedOrder === po.id;
                      const cfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.draft;
                      const actionable = isActionable(po.status);
                      const isCancelling = cancellingId === po.id;

                      return (
                        <Fragment key={po.id}>
                          <tr
                            className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                            onClick={() =>
                              setExpandedOrder(isExpanded ? null : po.id)
                            }
                          >
                            <td className="px-4 py-3.5">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-violet-400/90">
                                {po.po_number}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-gray-200 font-medium text-sm">
                              {po.supplier_name}
                            </td>
                            <td className="px-4 py-3.5 text-gray-300 text-sm">
                              {formatDate(po.expected_date)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cfg.color}`}
                              >
                                {STATUS_ICONS[po.status]}
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right text-gray-400">
                              {po.items.length}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-gray-200">
                              {formatINR(po.total_amount_paise)}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* WhatsApp share — available for all non-cancelled */}
                                {po.status !== 'cancelled' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        buildPOWhatsAppUrl(po, shopName),
                                        '_blank'
                                      );
                                    }}
                                    title="Share on WhatsApp"
                                    className="p-1.5 rounded-lg text-green-400/70 hover:text-green-400
                                               hover:bg-green-500/10 transition-colors"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Convert — only for actionable */}
                                {actionable && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConvertModal({
                                        type: 'po',
                                        orderId: po.id,
                                        orderNumber: po.po_number,
                                      });
                                    }}
                                    title="Receive Items"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                               bg-violet-500/10 text-violet-400 border border-violet-500/20
                                               hover:bg-violet-500/20 transition-colors"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    Receive
                                  </button>
                                )}

                                {/* Cancel — only for actionable */}
                                {actionable && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelPO(po.id, po.po_number);
                                    }}
                                    disabled={isCancelling}
                                    title="Cancel Order"
                                    className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400
                                               hover:bg-red-950/30 transition-colors
                                               disabled:opacity-50"
                                  >
                                    {isCancelling ? (
                                      <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}

                                {/* Cancelled — show dash */}
                                {po.status === 'cancelled' && (
                                  <span className="text-gray-600 text-xs">--</span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded line items */}
                          {isExpanded && po.items.length > 0 && (
                            <tr>
                              <td colSpan={8} className="bg-slate-950/50 px-4 py-4">
                                <div className="space-y-2">
                                  <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                                    Line Items
                                  </div>
                                  {po.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/5"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Package className="w-4 h-4 text-gray-600" />
                                        <div>
                                          <div className="text-sm text-gray-200">
                                            {item.product_name ?? 'Unknown product'}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Qty: {item.quantity}
                                            {item.product_unit ? ` ${item.product_unit}` : ''}{' '}
                                            @ {formatINR(item.expected_price_paise)}/unit
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-sm font-medium text-gray-300">
                                        {formatINR(
                                          item.expected_price_paise *
                                            Math.round(item.quantity)
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {po.notes && (
                                    <div className="px-4 py-2 text-xs text-gray-500 italic">
                                      Note: {po.notes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}

                          {isExpanded && po.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="bg-slate-950/50 px-4 py-4 text-xs text-gray-600"
                              >
                                No line items in this order.
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

            {/* FIX #4: Load More button for PO pagination */}
            {!loadingPO && poHasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMorePO}
                  disabled={loadingMorePO}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
                             text-gray-400 border border-white/5 hover:bg-white/5 hover:text-gray-300
                             transition-colors disabled:opacity-50"
                >
                  {loadingMorePO ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Orders'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* CONVERSION MODAL */}
      {/* ══════════════════════════════════════════════════════ */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    convertModal.type === 'so'
                      ? 'bg-emerald-500/15'
                      : 'bg-violet-500/15'
                  }`}
                >
                  <ArrowRightLeft
                    className={`w-5 h-5 ${
                      convertModal.type === 'so'
                        ? 'text-emerald-400'
                        : 'text-violet-400'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">
                    {convertModal.type === 'so'
                      ? 'Convert to Invoice'
                      : 'Receive Items'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {convertModal.orderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConvertModal(null);
                  setPaymentMode('cash');
                }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SO: Payment mode selector */}
            {convertModal.type === 'so' && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-400 mb-2.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setPaymentMode(mode.value)}
                      className={`
                        px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200
                        ${paymentMode === mode.value
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800/50 text-gray-400 border-white/5 hover:border-white/10 hover:text-gray-300'
                        }
                      `}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {paymentMode === 'credit' && (
                  <p className="mt-2 text-[11px] text-amber-400/80 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Amount will be added to customer&apos;s udhaar balance
                  </p>
                )}
              </div>
            )}

            {/* PO: Confirmation text */}
            {convertModal.type === 'po' && (
              <div className="mb-5 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <p className="text-xs text-gray-400">
                  This will create a purchase bill, stock-in all items to
                  inventory, and mark the PO as fulfilled. This action cannot
                  be undone.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setConvertModal(null);
                  setPaymentMode('cash');
                }}
                disabled={converting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                           text-gray-400 border border-white/5 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                  transition-all duration-200 disabled:opacity-50
                  ${convertModal.type === 'so'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-violet-500 hover:bg-violet-600 text-white'
                  }
                `}
              >
                {converting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {convertModal.type === 'so'
                      ? 'Create Invoice'
                      : 'Receive & Stock In'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* TOAST NOTIFICATION */}
      {/* ══════════════════════════════════════════════════════ */}
      {toast && (
        <div
          className={`
            fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl
            border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300
            ${toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/90 border-red-500/30 text-red-300'
            }
          `}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
