import { Fragment } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  buildPOWhatsAppUrl,
  formatOrderDate,
  isActionableOrder,
  type OrderConversionTarget,
} from '@/lib/orders/orderPresentation';
import type { PurchaseOrderRow } from '@/lib/orders/orderQueries';
import { formatINR } from '@/lib/types/database';
import { OrderItemsExpansion } from './OrderItemsExpansion';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrdersLoadMoreButton } from './OrdersLoadMoreButton';

interface PurchaseOrdersPanelProps {
  shopName: string;
  orders: PurchaseOrderRow[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  expandedOrder: string | null;
  cancellingId: string | null;
  onExpandedOrderChange: (orderId: string | null) => void;
  onOpenConvert: (target: OrderConversionTarget) => void;
  onCancel: (orderId: string, orderNumber: string) => void;
  onLoadMore: () => void;
}

export function PurchaseOrdersPanel({
  shopName,
  orders,
  loading,
  hasMore,
  loadingMore,
  expandedOrder,
  cancellingId,
  onExpandedOrderChange,
  onOpenConvert,
  onCancel,
  onLoadMore,
}: PurchaseOrdersPanelProps) {
  return (
    <div>
      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-500 text-sm mt-3">
            Loading purchase orders...
          </div>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-20">
          <Truck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No purchase orders yet.</p>
          <p className="text-gray-600 text-xs mt-1">
            Purchase orders will appear here when created. Convert them
            to purchase bills to receive stock.
          </p>
        </div>
      )}

      {!loading && orders.length > 0 && (
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
              {orders.map((order) => {
                const isExpanded = expandedOrder === order.id;
                const actionable = isActionableOrder(order.status);
                const isCancelling = cancellingId === order.id;

                return (
                  <Fragment key={order.id}>
                    <tr
                      className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() =>
                        onExpandedOrderChange(isExpanded ? null : order.id)
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
                          {order.po_number}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-200 font-medium text-sm">
                        {order.supplier_name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-300 text-sm">
                        {formatOrderDate(order.expected_date)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <OrderStatusBadge status={order.status} type="po" />
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-400">
                        {order.items.length}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-200">
                        {formatINR(order.total_amount_paise)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {order.status !== 'cancelled' && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                window.open(
                                  buildPOWhatsAppUrl(order, shopName),
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

                          {actionable && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenConvert({
                                  type: 'po',
                                  orderId: order.id,
                                  orderNumber: order.po_number,
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

                          {actionable && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onCancel(order.id, order.po_number);
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

                          {order.status === 'cancelled' && (
                            <span className="text-gray-600 text-xs">--</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    <OrderItemsExpansion
                      isExpanded={isExpanded}
                      items={order.items.map((item) => ({
                        id: item.id,
                        quantity: item.quantity,
                        productName: item.product_name,
                        productUnit: item.product_unit,
                        unitPricePaise: item.expected_price_paise,
                      }))}
                      notes={order.notes}
                    />
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OrdersLoadMoreButton
        visible={!loading && hasMore}
        loading={loadingMore}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
