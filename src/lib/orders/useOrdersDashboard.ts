import { useCallback, useEffect, useState } from 'react';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';
import {
  cancelPurchaseOrder,
  cancelSalesOrder,
  convertPurchaseOrder,
  convertSalesOrder,
  fetchPurchaseOrders,
  fetchSalesOrders,
  type PurchaseOrderRow,
  type SalesOrderRow,
} from './orderQueries';
import type {
  OrderConversionTarget,
  OrdersTab,
  OrdersToast,
} from './orderPresentation';

export function useOrdersDashboard() {
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [activeTab, setActiveTab] = useState<OrdersTab>('sales');
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loadingSO, setLoadingSO] = useState(true);
  const [loadingPO, setLoadingPO] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [soHasMore, setSOHasMore] = useState(false);
  const [poHasMore, setPOHasMore] = useState(false);
  const [loadingMoreSO, setLoadingMoreSO] = useState(false);
  const [loadingMorePO, setLoadingMorePO] = useState(false);
  const [poInitialized, setPOInitialized] = useState(false);
  const [convertModal, setConvertModal] = useState<OrderConversionTarget | null>(null);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [converting, setConverting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast] = useState<OrdersToast | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((context) => {
        if (context) {
          setShopId(context.shopId);
          setShopName(context.shopName);
        }
      });
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: OrdersToast['type']) => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  const loadSalesOrders = useCallback(async () => {
    if (!shopId) return;
    setLoadingSO(true);
    const result = await fetchSalesOrders(shopId, 0);
    setSalesOrders(result.rows);
    setSOHasMore(result.hasMore);
    setLoadingSO(false);
  }, [shopId]);

  const loadPurchaseOrders = useCallback(async () => {
    if (!shopId) return;
    setLoadingPO(true);
    const result = await fetchPurchaseOrders(shopId, 0);
    setPurchaseOrders(result.rows);
    setPOHasMore(result.hasMore);
    setLoadingPO(false);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    loadSalesOrders();
    setPOInitialized(false);
  }, [shopId, loadSalesOrders]);

  useEffect(() => {
    if (activeTab === 'purchase' && !poInitialized && shopId) {
      setPOInitialized(true);
      loadPurchaseOrders();
    }
  }, [activeTab, poInitialized, shopId, loadPurchaseOrders]);

  async function handleLoadMoreSO() {
    setLoadingMoreSO(true);
    const result = await fetchSalesOrders(shopId, salesOrders.length);
    setSalesOrders((previous) => [...previous, ...result.rows]);
    setSOHasMore(result.hasMore);
    setLoadingMoreSO(false);
  }

  async function handleLoadMorePO() {
    setLoadingMorePO(true);
    const result = await fetchPurchaseOrders(shopId, purchaseOrders.length);
    setPurchaseOrders((previous) => [...previous, ...result.rows]);
    setPOHasMore(result.hasMore);
    setLoadingMorePO(false);
  }

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
          showToast(result.error ?? 'Failed to convert sales order', 'error');
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
          showToast(result.error ?? 'Failed to convert purchase order', 'error');
        }
      }
    } catch {
      showToast('Unexpected error during conversion', 'error');
    }

    setConverting(false);
    setConvertModal(null);
    setPaymentMode('cash');
  }

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

  function closeConvertModal() {
    setConvertModal(null);
    setPaymentMode('cash');
  }

  return {
    shopId,
    shopName,
    activeTab,
    setActiveTab,
    salesOrders,
    purchaseOrders,
    loadingSO,
    loadingPO,
    expandedOrder,
    setExpandedOrder,
    soHasMore,
    poHasMore,
    loadingMoreSO,
    loadingMorePO,
    convertModal,
    setConvertModal,
    paymentMode,
    setPaymentMode,
    converting,
    cancellingId,
    toast,
    setToast,
    handleLoadMoreSO,
    handleLoadMorePO,
    handleConvert,
    handleCancelSO,
    handleCancelPO,
    closeConvertModal,
  };
}
