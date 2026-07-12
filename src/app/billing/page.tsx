'use client';

import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import { useBillingStore, type SelectedCustomer } from '@/lib/billing/useBillingStore';
import { useKeyboardShortcuts, useBarcodeScanner } from '@/lib/billing/useKeyboardShortcuts';
import { buildInvoiceSaveParams, buildSalesOrderParams } from '@/lib/billing/buildBillingPayloads';
import { PAYMENT_MODES } from '@/lib/billing/paymentModes';
import { useBillingSearch } from '@/lib/billing/useBillingSearch';
import { useBillingShopContext, usePendingOnlineOrders } from '@/lib/billing/useBillingShop';
import { validateBillingState } from '@/lib/billing/validateInvoice';
import { formatINR } from '@/lib/types/database';
import type { Product } from '@/lib/types/database';
import {
  lookupBarcode,
  saveInvoice,
  processCreditRepayment,
  refreshCustomer,
  uploadCustomerImage,
  createNewCustomer,
  fetchCustomerLoyalty,
} from '@/lib/billing/billingQueries';
import { MOCK_PRODUCTS } from '@/lib/billing/mockData';
import { PaymentModal } from '@/components/billing/PaymentModal';
import { RepaymentModal } from '@/components/billing/RepaymentModal';
import { CreateCustomerModal } from '@/components/billing/CreateCustomerModal';
import { OnlineOrdersDrawer } from '@/components/billing/OnlineOrdersDrawer';
import { BillingHeader } from '@/components/billing/BillingHeader';
import { ProductSearchBar } from '@/components/billing/ProductSearchBar';
import { LineItemsGrid } from '@/components/billing/LineItemsGrid';
import { BillingFooter } from '@/components/billing/BillingFooter';
import { CustomerBar } from '@/components/billing/CustomerBar';
import TopNav from '@/components/layout/TopNav';
import { createClient } from '@/lib/supabase/client';
import { saveSalesOrder } from '@/lib/orders/orderQueries';
import { getIndiaDate, getIndianFinancialYear } from '@/lib/utils/indiaDate';

// ── Check if Supabase is configured ──
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_CONFIGURED =
  !DEMO_MODE &&
  SUPABASE_URL.length > 0 &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY.length > 30;

export default function BillingPage() {
  const {
    shopContext: shopCtx,
    shopId,
    gstType,
    shopStateCode,
    shopUpiId,
    shopName,
  } = useBillingShopContext(SUPABASE_CONFIGURED);
  const { pendingOnlineCount, setPendingOnlineCount } = usePendingOnlineOrders(
    shopId,
    SUPABASE_CONFIGURED
  );

  const { state, actions } = useBillingStore(gstType, shopStateCode);

  // ── Refs for keyboard navigation ──
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const {
    customerQuery,
    setCustomerQuery,
    productQuery,
    setProductQuery,
    showCustomerDropdown,
    setShowCustomerDropdown,
    showProductDropdown,
    setShowProductDropdown,
    filteredCustomers,
    filteredProducts,
  } = useBillingSearch({
    shopId,
    supabaseConfigured: SUPABASE_CONFIGURED,
    demoMode: DEMO_MODE,
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<string | false>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // ── UPI Payment Modal state ──
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [pendingUpiTotalPaise, setPendingUpiTotalPaise] = useState<number | null>(null);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);

  // ── Repayment modal state ──
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentProcessing, setRepaymentProcessing] = useState(false);

  // Prevent a slow lookup for customer A from overwriting customer B.
  const loyaltyRequestRef = useRef(0);
  const [loyaltyLoadingCustomerId, setLoyaltyLoadingCustomerId] = useState<string | null>(null);

  // ── B2B GSTIN input state ──
  const [showGstinInput, setShowGstinInput] = useState(false);
  const [gstinDraft, setGstinDraft] = useState('');

  // ── Create customer modal state ──
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // ── Online orders drawer state ──
  const [showOnlineOrders, setShowOnlineOrders] = useState(false);

  // ── Customer photo upload ref ──
  const customerPhotoRef = useRef<HTMLInputElement>(null);

  // ── Handlers ──
  const handleSelectCustomer = useCallback(
    (customer: SelectedCustomer) => {
      const requestId = ++loyaltyRequestRef.current;

      // Set customer immediately with loyaltyPoints=0 for instant UI response
      actions.setCustomer(customer);
      setCustomerQuery(customer.phoneNumber);
      setGstinDraft(customer.gstin ?? '');
      setShowGstinInput(false);
      setShowCustomerDropdown(false);
      productSearchRef.current?.focus();

      // Lazy-load loyalty points in the background (non-blocking)
      if (SUPABASE_CONFIGURED && shopId) {
        setLoyaltyLoadingCustomerId(customer.id);
        fetchCustomerLoyalty(customer.id, shopId)
          .then((points) => {
            if (loyaltyRequestRef.current !== requestId) return;
            actions.setCustomer({ ...customer, loyaltyPoints: points });
          })
          .finally(() => {
            if (loyaltyRequestRef.current === requestId) {
              setLoyaltyLoadingCustomerId(null);
            }
          });
      } else {
        setLoyaltyLoadingCustomerId(null);
      }
    },
    [actions, setCustomerQuery, setShowCustomerDropdown, shopId]
  );

  // ── Low stock warning state ──
  const [lowStockWarning, setLowStockWarning] = useState<string | false>(false);

  // ── Product inventory metadata cache (for in-memory low-stock alert at save time) ──
  // Tracks { is_stock_tracked, low_stock_threshold, name, stockAtAddTime } per productId
  const productStockMetaRef = useRef<
    Map<string, { name: string; isTracked: boolean; threshold: number; stockAtAddTime: number }>
  >(new Map());

  const handleAddProduct = useCallback(
    async (product: Product) => {
      actions.addProduct(product);
      setProductQuery('');
      setShowProductDropdown(false);
      productSearchRef.current?.focus();

      // Cache product inventory metadata for low-stock alert at save time
      if (product.is_stock_tracked && SUPABASE_CONFIGURED && shopId) {
        const supabase = createClient();
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity_in_stock')
          .eq('shop_id', shopId)
          .eq('product_id', product.id)
          .limit(1)
          .maybeSingle();

        const stock = inv ? Number(inv.quantity_in_stock) : 0;

        productStockMetaRef.current.set(product.id, {
          name: product.name,
          isTracked: true,
          threshold: product.low_stock_threshold ?? 5,
          stockAtAddTime: stock,
        });

        // Soft-block: warn if tracked product has zero/negative stock
        if (stock <= 0) {
          setLowStockWarning(`Low Stock: "${product.name}" billed but stock will go negative.`);
          setTimeout(() => setLowStockWarning(false), 5000);
        }
      }
    },
    [actions, setProductQuery, setShowProductDropdown, shopId]
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (SUPABASE_CONFIGURED) {
        const product = await lookupBarcode(barcode, shopId);
        if (product) actions.addByBarcode(product);
      } else {
        const product = MOCK_PRODUCTS.find((p) => p.barcode === barcode);
        if (product) actions.addByBarcode(product);
      }
    },
    [actions, shopId]
  );

  const handleCyclePayment = useCallback(() => {
    const currentIdx = PAYMENT_MODES.indexOf(state.paymentMode);
    const nextIdx = (currentIdx + 1) % PAYMENT_MODES.length;
    actions.setPaymentMode(PAYMENT_MODES[nextIdx]);
  }, [state.paymentMode, actions]);

  // ── Core save logic (extracted for reuse by UPI modal callback) ──
  const executeSave = useCallback(async () => {
    setIsSaving(true);
    setValidationErrors([]);

    if (state.customer && loyaltyLoadingCustomerId === state.customer.id) {
      setIsSaving(false);
      setValidationErrors(['Customer loyalty balance is still loading. Please try again in a moment.']);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    if (SUPABASE_CONFIGURED && !shopId) {
      setIsSaving(false);
      setValidationErrors(['Shop context not loaded. Please sign in again.']);
      setTimeout(() => setValidationErrors([]), 5000);
      return;
    }

    // ── Build RPC payload ──
    const saveParams = buildInvoiceSaveParams(state, shopId, getIndiaDate());

    if (SUPABASE_CONFIGURED) {
      const { data, error } = await saveInvoice(saveParams);

      setIsSaving(false);

      if (error) {
        setValidationErrors([`Database error: ${error}`]);
        setTimeout(() => setValidationErrors([]), 5000);
        return;
      }

      const invoiceId = data!.invoice_id;
      const invoiceNumber = data!.invoice_number;

      setSaveSuccess(`Invoice ${invoiceNumber} saved!`);

      // Inventory deduction now happens atomically inside save_invoice V2 (migration 022).
      // No frontend adjust_stock calls needed.

      if (printFrameRef.current) {
        printFrameRef.current.src = `/receipt/${invoiceId}`;
      }

      if (state.customer?.phoneNumber) {
        fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: invoiceId,
          }),
        }).catch(() => {});
      }

      // Phase 26 V2: In-memory low-stock alert — no DB queries needed
      // Uses productStockMetaRef populated at add-to-cart time
      for (let i = 0; i < state.lineItems.length; i++) {
        const lineItem = state.lineItems[i];
        const computed = state.totals.lineItems[i];
        if (!lineItem.productId) continue;
        const meta = productStockMetaRef.current.get(lineItem.productId);
        if (!meta?.isTracked) continue;

        const expectedNewStock = meta.stockAtAddTime - computed.quantity;
        if (expectedNewStock < meta.threshold) {
          // Fire-and-forget WhatsApp low-stock alert to shop owner
          fetch('/api/whatsapp/send-system-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: lineItem.productId,
            }),
          }).catch(() => {});
        }
      }

      // Clear the product stock metadata cache after save
      productStockMetaRef.current.clear();

      setTimeout(() => {
        setSaveSuccess(false);
        actions.clearBill();
      }, 3000);
    } else if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 300));
      setIsSaving(false);

      const mockId = crypto.randomUUID();
      setSaveSuccess('Invoice BG/2025-26/00001 saved (mock)!');

      if (printFrameRef.current) {
        printFrameRef.current.src = `/receipt/${mockId}`;
      }

      if (state.customer?.phoneNumber) {
        fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: mockId,
          }),
        }).catch(() => {});
      }

      setTimeout(() => {
        setSaveSuccess(false);
        actions.clearBill();
      }, 3000);
    } else {
      setIsSaving(false);
      setValidationErrors(['Supabase is not configured. Enable demo mode explicitly to use mock billing.']);
      setTimeout(() => setValidationErrors([]), 5000);
    }
  }, [state, shopId, actions, loyaltyLoadingCustomerId]);

  // ── Split-path checkout handler ──
  // UPI + shop has upi_id → show QR modal first, save on confirm
  // All other modes → save instantly
  const handleSaveBill = useCallback(async () => {
    if (isSaving) return;

    if (SUPABASE_CONFIGURED && !shopId) {
      setValidationErrors(['Shop context not loaded. Please sign in again.']);
      setSaveSuccess(false);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    if (state.customer && loyaltyLoadingCustomerId === state.customer.id) {
      setValidationErrors(['Customer loyalty balance is still loading. Please try again in a moment.']);
      setSaveSuccess(false);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    // Validate first (same for all paths)
    const indiaDate = getIndiaDate();
    const financialYear = getIndianFinancialYear(indiaDate);
    const validationShopId = DEMO_MODE
      ? '00000000-0000-0000-0000-000000000000'
      : shopId;
    const result = validateBillingState(
      state,
      validationShopId,
      financialYear,
      `BG/${financialYear}/00001`,
      1,
      null
    );
    if (!result.valid) {
      setValidationErrors(result.errors);
      setSaveSuccess(false);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    // ── UPI path: show QR modal, defer save ──
    if (state.paymentMode === 'upi' && shopUpiId) {
      pendingSaveRef.current = executeSave;
      setPendingUpiTotalPaise(state.totals.totalPaise);
      setShowUpiModal(true);
      return;
    }

    // ── All other modes: save instantly ──
    await executeSave();
  }, [state, shopId, isSaving, shopUpiId, executeSave, loyaltyLoadingCustomerId]);

  // ── Reserve as Sales Order ──
  const handleReserveSO = useCallback(async () => {
    if (isReserving || isSaving) return;

    // Must have at least one line item
    if (state.lineItems.length === 0) {
      setValidationErrors(['Add at least one product to create a sales order']);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    // Must have a customer for SO
    if (!state.customer) {
      setValidationErrors(['Select a customer before reserving a sales order']);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    // Must have valid products
    const salesOrderParams = buildSalesOrderParams(state, shopId, shopCtx?.userId);
    if (salesOrderParams.items.length === 0) {
      setValidationErrors(['No valid products in cart']);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    setIsReserving(true);
    setValidationErrors([]);

    const result = await saveSalesOrder(salesOrderParams);

    setIsReserving(false);

    if (result.success) {
      const soNumber = (result.data?.so_number as string) ?? '';
      setSaveSuccess(`Sales Order ${soNumber} created!`);
      setTimeout(() => {
        setSaveSuccess(false);
        actions.clearBill();
      }, 3000);
    } else {
      setValidationErrors([result.error ?? 'Failed to create sales order']);
      setTimeout(() => setValidationErrors([]), 5000);
    }
  }, [state, shopId, shopCtx, isReserving, isSaving, actions]);

  // ── UPI modal callbacks ──
  const handleUpiConfirm = useCallback(async () => {
    setShowUpiModal(false);
    if (pendingSaveRef.current) {
      await pendingSaveRef.current();
      pendingSaveRef.current = null;
    }
    setPendingUpiTotalPaise(null);
  }, []);

  const handleUpiCancel = useCallback(() => {
    setShowUpiModal(false);
    pendingSaveRef.current = null;
    setPendingUpiTotalPaise(null);
  }, []);

  const handleNavigateUp = useCallback(() => {
    if (state.activeLineIndex > 0) {
      actions.setActiveLine(state.activeLineIndex - 1);
    }
  }, [state.activeLineIndex, actions]);

  const handleNavigateDown = useCallback(() => {
    if (state.activeLineIndex < state.lineItems.length - 1) {
      actions.setActiveLine(state.activeLineIndex + 1);
    }
  }, [state.activeLineIndex, state.lineItems.length, actions]);

  const handleRemoveActive = useCallback(() => {
    if (state.lineItems.length > 0) {
      actions.removeLineItem(state.activeLineIndex);
    }
  }, [state.activeLineIndex, state.lineItems.length, actions]);

  const handleIncrementQty = useCallback(() => {
    if (state.lineItems.length > 0) {
      actions.incrementQuantity(state.activeLineIndex);
    }
  }, [state.activeLineIndex, state.lineItems.length, actions]);

  const handleDecrementQty = useCallback(() => {
    if (state.lineItems.length > 0) {
      actions.decrementQuantity(state.activeLineIndex);
    }
  }, [state.activeLineIndex, state.lineItems.length, actions]);

  const handleCustomerPhotoChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !state.customer) return;

    const { error: uploadError } = await uploadCustomerImage(
      file,
      shopId,
      state.customer.id
    );
    if (uploadError) {
      setValidationErrors([uploadError]);
      setTimeout(() => setValidationErrors([]), 4000);
    } else {
      const updated = await refreshCustomer(shopId, state.customer.id);
      if (updated) actions.setCustomer(updated);
      setSaveSuccess('Photo uploaded!');
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    event.target.value = '';
  }, [actions, shopId, state.customer]);

  const handleCommitGstin = useCallback(() => {
    const value = gstinDraft.trim();
    if (value.length === 0) {
      actions.setBuyerGstin(null);
      setShowGstinInput(false);
    } else if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/.test(value)) {
      actions.setBuyerGstin(value);
      setShowGstinInput(false);
    } else {
      setValidationErrors(['Invalid GSTIN format — must be 15 chars like 27AAPFU0939F1ZV']);
      setTimeout(() => setValidationErrors([]), 3000);
    }
  }, [actions, gstinDraft]);

  const handleCancelGstin = useCallback(() => {
    setShowGstinInput(false);
    setGstinDraft(state.customer?.gstin ?? '');
  }, [state.customer?.gstin]);

  const handleClearCustomer = useCallback(() => {
    loyaltyRequestRef.current += 1;
    setLoyaltyLoadingCustomerId(null);
    actions.setCustomer(null);
    setCustomerQuery('');
    setGstinDraft('');
    setShowGstinInput(false);
  }, [actions, setCustomerQuery]);

  const handleOpenCreateCustomer = useCallback(() => {
    setShowCustomerDropdown(false);
    setShowCreateCustomer(true);
  }, [setShowCustomerDropdown]);

  const billingInteractionLocked =
    showUpiModal ||
    showRepaymentModal ||
    showCreateCustomer ||
    showOnlineOrders ||
    isSaving ||
    isReserving ||
    repaymentProcessing;

  // ── Register keyboard shortcuts ──
  useKeyboardShortcuts(
    { customerSearchRef, productSearchRef, barcodeInputRef },
    {
      onSaveBill: handleSaveBill,
      onClearBill: actions.clearBill,
      onCyclePaymentMode: handleCyclePayment,
      onRemoveActiveLine: handleRemoveActive,
      onNavigateUp: handleNavigateUp,
      onNavigateDown: handleNavigateDown,
      onIncrementQty: handleIncrementQty,
      onDecrementQty: handleDecrementQty,
      lineItemCount: state.lineItems.length,
    },
    billingInteractionLocked
  );

  const { handleKeyPress: handleBarcodeKeyPress } = useBarcodeScanner(handleBarcodeScan);

  const isComposition = state.totals.documentType === 'bill_of_supply';

  return (
    <div className="h-screen w-full bg-gray-950 text-gray-200 flex flex-col overflow-hidden select-none">
      <TopNav />
      {/* ── Hidden barcode scanner input ── */}
      <input
        ref={barcodeInputRef}
        className="absolute -top-10 opacity-0"
        onKeyDown={(e) => handleBarcodeKeyPress(e)}
        tabIndex={-1}
        aria-hidden="true"
      />

      <BillingHeader
        shopName={shopName}
        isComposition={isComposition}
        pendingOnlineCount={pendingOnlineCount}
        onOpenOnlineOrders={() => setShowOnlineOrders(true)}
      />

      <CustomerBar
        customerSearchRef={customerSearchRef}
        customerPhotoRef={customerPhotoRef}
        query={customerQuery}
        showDropdown={showCustomerDropdown}
        customers={filteredCustomers}
        selectedCustomer={state.customer}
        showGstinInput={showGstinInput}
        gstinDraft={gstinDraft}
        onQueryChange={setCustomerQuery}
        onShowDropdownChange={setShowCustomerDropdown}
        onSelectCustomer={handleSelectCustomer}
        onOpenCreateCustomer={handleOpenCreateCustomer}
        onPhotoChange={handleCustomerPhotoChange}
        onShowGstinInput={() => setShowGstinInput(true)}
        onGstinDraftChange={setGstinDraft}
        onCommitGstin={handleCommitGstin}
        onCancelGstin={handleCancelGstin}
        onOpenRepayment={() => setShowRepaymentModal(true)}
        onClearCustomer={handleClearCustomer}
      />

      <ProductSearchBar
        productSearchRef={productSearchRef}
        query={productQuery}
        showDropdown={showProductDropdown}
        products={filteredProducts}
        lineItemCount={state.lineItems.length}
        onQueryChange={setProductQuery}
        onShowDropdownChange={setShowProductDropdown}
        onAddProduct={handleAddProduct}
      />

      <LineItemsGrid
        state={state}
        isComposition={isComposition}
        onSetActiveLine={actions.setActiveLine}
        onUpdateQuantity={actions.updateQuantity}
        onIncrementQuantity={actions.incrementQuantity}
        onDecrementQuantity={actions.decrementQuantity}
        onRemoveLineItem={actions.removeLineItem}
      />

      <BillingFooter
        state={state}
        isComposition={isComposition}
        validationErrors={validationErrors}
        saveSuccess={saveSuccess}
        lowStockWarning={lowStockWarning}
        isSaving={isSaving}
        isReserving={isReserving}
        onCyclePayment={handleCyclePayment}
        onClearBill={actions.clearBill}
        onReserveSalesOrder={handleReserveSO}
        onSaveBill={handleSaveBill}
      />

      {/* Hidden iframe for thermal print — loads /receipt/[id] and auto-prints */}
      <iframe
        ref={printFrameRef}
        style={{ display: 'none', width: 0, height: 0 }}
        title="Print Receipt"
      />

      {/* ── UPI Payment Modal ── */}
      <PaymentModal
        isOpen={showUpiModal}
        totalPaise={pendingUpiTotalPaise ?? state.totals.totalPaise}
        shopName={shopName}
        shopUpiId={shopUpiId ?? ''}
        onConfirm={handleUpiConfirm}
        onCancel={handleUpiCancel}
      />

      {/* ── Repayment (Settle Udhaar) Modal ── */}
      <RepaymentModal
        isOpen={showRepaymentModal}
        customerName={state.customer?.name ?? 'Customer'}
        creditBalancePaise={state.customer?.creditBalancePaise ?? 0}
        onConfirm={async (amountPaise, notes) => {
          if (!state.customer || repaymentProcessing) return;
          setRepaymentProcessing(true);
          setShowRepaymentModal(false);

          const result = await processCreditRepayment(
            shopId,
            state.customer.id,
            amountPaise,
            notes || null
          );

          if (result.error) {
            setValidationErrors([result.error]);
            setTimeout(() => setValidationErrors([]), 5000);
          } else {
            setSaveSuccess(`Payment of ${formatINR(amountPaise)} received!`);
            setTimeout(() => setSaveSuccess(false), 3000);

            // Refresh customer to get updated balance
            const updated = await refreshCustomer(shopId, state.customer!.id);
            if (updated) actions.setCustomer(updated);
          }
          setRepaymentProcessing(false);
        }}
        onCancel={() => setShowRepaymentModal(false)}
      />

      {/* ── Create New Customer Modal ── */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        prefillPhone={customerQuery.replace(/\D/g, '')}
        isSaving={isCreatingCustomer}
        onSave={async (name, phone, photoFile, marketingConsent) => {
          setIsCreatingCustomer(true);
          const { customer, error: createErr } = await createNewCustomer(
            shopId,
            name,
            phone,
            photoFile,
            marketingConsent
          );
          setIsCreatingCustomer(false);

          if (createErr || !customer) {
            setValidationErrors([createErr ?? 'Failed to create customer']);
            setTimeout(() => setValidationErrors([]), 5000);
            return;
          }

          // Close modal + set as active customer
          setShowCreateCustomer(false);
          loyaltyRequestRef.current += 1;
          setLoyaltyLoadingCustomerId(null);
          actions.setCustomer(customer);
          setCustomerQuery(customer.phoneNumber);
          setSaveSuccess(`Customer "${customer.name}" created!`);
          setTimeout(() => setSaveSuccess(false), 3000);
          productSearchRef.current?.focus();
        }}
        onCancel={() => setShowCreateCustomer(false)}
      />

      {/* ── Online Orders Drawer ── */}
      <OnlineOrdersDrawer
        isOpen={showOnlineOrders}
        onClose={() => setShowOnlineOrders(false)}
        shopId={shopId}
        onAccepted={(invoiceId) => {
          // Trigger print via hidden iframe
          if (printFrameRef.current) {
            printFrameRef.current.src = `/receipt/${invoiceId}`;
          }
          setSaveSuccess('Order accepted! Printing receipt...');
          setTimeout(() => setSaveSuccess(false), 3000);
        }}
        onCountChange={(count) => setPendingOnlineCount(count)}
      />
    </div>
  );
}
