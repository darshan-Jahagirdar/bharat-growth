'use client';

import TopNav from '@/components/layout/TopNav';
import { OrderConversionDialog } from '@/components/orders/OrderConversionDialog';
import { OrdersHeader } from '@/components/orders/OrdersHeader';
import { OrdersToast } from '@/components/orders/OrdersToast';
import { PurchaseOrdersPanel } from '@/components/orders/PurchaseOrdersPanel';
import { SalesOrdersPanel } from '@/components/orders/SalesOrdersPanel';
import { isActionableOrder } from '@/lib/orders/orderPresentation';
import { useOrdersDashboard } from '@/lib/orders/useOrdersDashboard';

export default function OrdersPage() {
  const orders = useOrdersDashboard();
  const salesActiveCount = orders.salesOrders.filter((order) =>
    isActionableOrder(order.status)
  ).length;
  const purchaseActiveCount = orders.purchaseOrders.filter((order) =>
    isActionableOrder(order.status)
  ).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <OrdersHeader
          activeTab={orders.activeTab}
          salesActiveCount={salesActiveCount}
          purchaseActiveCount={purchaseActiveCount}
          onTabChange={orders.setActiveTab}
        />

        {orders.activeTab === 'sales' && (
          <SalesOrdersPanel
            shopId={orders.shopId}
            shopName={orders.shopName}
            orders={orders.salesOrders}
            loading={orders.loadingSO}
            hasMore={orders.soHasMore}
            loadingMore={orders.loadingMoreSO}
            expandedOrder={orders.expandedOrder}
            cancellingId={orders.cancellingId}
            onExpandedOrderChange={orders.setExpandedOrder}
            onOpenConvert={orders.setConvertModal}
            onCancel={orders.handleCancelSO}
            onLoadMore={orders.handleLoadMoreSO}
          />
        )}

        {orders.activeTab === 'purchase' && (
          <PurchaseOrdersPanel
            shopName={orders.shopName}
            orders={orders.purchaseOrders}
            loading={orders.loadingPO}
            hasMore={orders.poHasMore}
            loadingMore={orders.loadingMorePO}
            expandedOrder={orders.expandedOrder}
            cancellingId={orders.cancellingId}
            onExpandedOrderChange={orders.setExpandedOrder}
            onOpenConvert={orders.setConvertModal}
            onCancel={orders.handleCancelPO}
            onLoadMore={orders.handleLoadMorePO}
          />
        )}
      </div>

      <OrderConversionDialog
        target={orders.convertModal}
        paymentMode={orders.paymentMode}
        converting={orders.converting}
        onPaymentModeChange={orders.setPaymentMode}
        onClose={orders.closeConvertModal}
        onConvert={orders.handleConvert}
      />

      <OrdersToast
        toast={orders.toast}
        onClose={() => orders.setToast(null)}
      />
    </div>
  );
}
