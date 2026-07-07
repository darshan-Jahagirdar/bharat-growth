'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useBillingStore, type SelectedCustomer } from '@/lib/billing/useBillingStore';
import { useKeyboardShortcuts, useBarcodeScanner } from '@/lib/billing/useKeyboardShortcuts';
import { validateBillingState } from '@/lib/billing/validateInvoice';
import { formatINR } from '@/lib/types/database';
import type { PaymentMode, Product } from '@/lib/types/database';
import {
  searchCustomers,
  searchProducts,
  lookupBarcode,
  saveInvoice,
  processCreditRepayment,
  refreshCustomer,
  uploadCustomerImage,
  createNewCustomer,
  fetchCustomerLoyalty,
} from '@/lib/billing/billingQueries';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS } from '@/lib/billing/mockData';
import { PaymentModal } from '@/components/billing/PaymentModal';
import { RepaymentModal } from '@/components/billing/RepaymentModal';
import { CreateCustomerModal } from '@/components/billing/CreateCustomerModal';
import { OnlineOrdersDrawer } from '@/components/billing/OnlineOrdersDrawer';
import TopNav from '@/components/layout/TopNav';
import { checkUserOnboarded, type UserShopContext } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';
import { saveSalesOrder } from '@/lib/orders/orderQueries';

// ── Check if Supabase is configured ──
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_CONFIGURED =
  !DEMO_MODE &&
  SUPABASE_URL.length > 0 &&
  !SUPABASE_URL.includes('your-project') &&
  SUPABASE_ANON_KEY.length > 30;

// ── Payment mode cycle ──
const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'credit'];
const PAYMENT_LABELS: Record<PaymentMode, string> = {
  cash: '₹ Cash', upi: 'UPI', card: 'Card', credit: 'Credit', split: 'Split',
  online_upi: 'Online UPI', online_khata: 'Online Khata',
};

export default function BillingPage() {
  // Shop context — resolved from authenticated user
  const [shopCtx, setShopCtx] = useState<UserShopContext | null>(null);
  const shopId = shopCtx?.shopId ?? '';
  const gstType = (shopCtx?.gstType ?? 'regular') as 'regular' | 'composition';
  const shopStateCode = shopCtx?.stateCode ?? '27';

  const { state, actions } = useBillingStore(gstType, shopStateCode);

  // ── Refs for keyboard navigation ──
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // ── Search states ──
  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<string | false>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // ── UPI Payment Modal state ──
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [shopUpiId, setShopUpiId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);

  // ── Repayment modal state ──
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentProcessing, setRepaymentProcessing] = useState(false);

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

  // ── Async search results ──
  const [filteredCustomers, setFilteredCustomers] = useState<SelectedCustomer[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // ── Pending online orders count ──
  const [pendingOnlineCount, setPendingOnlineCount] = useState(0);

  // ── Resolve shop context from authenticated user ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) setShopCtx(ctx);
      });
    });
  }, []);

  // ── Fetch shop UPI ID once shop is resolved ──
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !shopId) return;
    import('@/lib/billing/billingQueries').then(({ fetchShopContext }) => {
      fetchShopContext(shopId).then((shop) => {
        if (shop) {
          setShopUpiId(shop.upi_id ?? null);
          setShopName(shop.business_name);
        }
      });
    });
  }, [shopId]);

  // ── Poll + Realtime pending online orders ──
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !shopId) return;
    const supabase = createClient();
    const fetchCount = () => {
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'pending_online')
        .then(({ count, error }) => {
          if (error) {
            console.error('[PendingOrders] Poll failed:', error.message);
          } else {
            setPendingOnlineCount(count ?? 0);
          }
        });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);

    const channel = supabase
      .channel('pending-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices', filter: `shop_id=eq.${shopId}` },
        (payload) => {
          if (payload.new && (payload.new as Record<string, unknown>).status === 'pending_online') {
            console.log('[PendingOrders] Realtime: new online order!');
            fetchCount();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  // ── Customer search with debounce (350ms to avoid firing on every keystroke) ──
  useEffect(() => {
    if (!customerQuery || customerQuery.length < 2) {
      setFilteredCustomers([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (SUPABASE_CONFIGURED && shopId) {
        const results = await searchCustomers(customerQuery, shopId);
        setFilteredCustomers(results);
      } else if (DEMO_MODE) {
        // Fallback to mock data
        const q = customerQuery.toLowerCase();
        setFilteredCustomers(
          MOCK_CUSTOMERS.filter(
            (c) => c.phoneNumber.includes(q) || (c.name && c.name.toLowerCase().includes(q))
          )
        );
      } else {
        setFilteredCustomers([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerQuery, shopId]);

  // ── Product search with debounce ──
  useEffect(() => {
    if (!productQuery || productQuery.length < 1) {
      setFilteredProducts([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (SUPABASE_CONFIGURED && shopId) {
        const results = await searchProducts(productQuery, shopId);
        setFilteredProducts(results);
      } else if (DEMO_MODE) {
        const q = productQuery.toLowerCase();
        setFilteredProducts(
          MOCK_PRODUCTS.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.sku && p.sku.toLowerCase().includes(q)) ||
              p.hsn_code.includes(q)
          )
        );
      } else {
        setFilteredProducts([]);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [productQuery, shopId]);

  // ── Handlers ──
  const handleSelectCustomer = useCallback(
    (customer: SelectedCustomer) => {
      // Set customer immediately with loyaltyPoints=0 for instant UI response
      actions.setCustomer(customer);
      setCustomerQuery(customer.phoneNumber);
      setGstinDraft(customer.gstin ?? '');
      setShowGstinInput(false);
      setShowCustomerDropdown(false);
      productSearchRef.current?.focus();

      // Lazy-load loyalty points in the background (non-blocking)
      if (SUPABASE_CONFIGURED && shopId) {
        fetchCustomerLoyalty(customer.id, shopId).then((points) => {
          if (points > 0) {
            actions.setCustomer({ ...customer, loyaltyPoints: points });
          }
        });
      }
    },
    [actions, shopId]
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
    [actions, shopId]
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

    if (SUPABASE_CONFIGURED && !shopId) {
      setIsSaving(false);
      setValidationErrors(['Shop context not loaded. Please sign in again.']);
      setTimeout(() => setValidationErrors([]), 5000);
      return;
    }

    // ── Build RPC payload ──
    const invoicePayload = {
      shop_id: shopId,
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_type: 'regular',
      document_type: state.totals.documentType,
      customer_id: state.customer?.id ?? null,
      customer_name: state.customer?.name ?? null,
      customer_phone: state.customer?.phoneNumber ?? null,
      customer_gstin: state.customer?.gstin ?? null,
      billing_state_code: state.shopStateCode,
      is_inter_state: state.isInterState,
      subtotal_paise: state.totals.subtotalPaise,
      cgst_total_paise: state.totals.cgstTotalPaise,
      sgst_total_paise: state.totals.sgstTotalPaise,
      igst_total_paise: state.totals.igstTotalPaise,
      discount_paise: state.totals.discountPaise,
      round_off_paise: state.totals.roundOffPaise,
      total_paise: state.totals.totalPaise,
      payment_mode: state.paymentMode,
      payment_reference: null,
      created_by: null,
    };

    const itemsPayload = state.totals.lineItems.map((computed, i) => ({
      product_id: state.lineItems[i].productId,
      product_name: computed.productName,
      hsn_code: computed.hsnCode,
      quantity: computed.quantity,
      unit: computed.unit,
      unit_price_paise: computed.unitPricePaise,
      discount_paise: computed.discountPaise,
      taxable_amount_paise: computed.taxableAmountPaise,
      gst_rate_percent: computed.gstRatePercent,
      cgst_paise: computed.cgstPaise,
      sgst_paise: computed.sgstPaise,
      igst_paise: computed.igstPaise,
      total_paise: computed.totalPaise,
      batch_number: null,
    }));

    const loyaltyEntry = state.customer
      ? {
          customer_id: state.customer.id,
          entry_type: 'earn',
          points: Math.floor(state.totals.totalPaise / 10000),
          running_balance:
            state.customer.loyaltyPoints +
            Math.floor(state.totals.totalPaise / 10000),
          description: undefined as string | undefined,
        }
      : null;

    if (SUPABASE_CONFIGURED) {
      const { data, error } = await saveInvoice({
        invoice: invoicePayload,
        items: itemsPayload,
        loyaltyEntry: loyaltyEntry,
      });

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
  }, [state, shopId, actions]);

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

    // Validate first (same for all paths)
    const result = validateBillingState(
      state, shopId, '2025-26', 'BG/2025-26/00001', 1, null
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
      setShowUpiModal(true);
      return;
    }

    // ── All other modes: save instantly ──
    await executeSave();
  }, [state, shopId, isSaving, shopUpiId, executeSave]);

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
    const validItems = state.lineItems
      .map((li, index) => ({ li, index }))
      .filter(({ li }) => li.productId);
    if (validItems.length === 0) {
      setValidationErrors(['No valid products in cart']);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    setIsReserving(true);
    setValidationErrors([]);

    const result = await saveSalesOrder({
      shopId,
      customerId: state.customer.id,
      totalAmountPaise: state.totals.totalPaise,
      createdBy: shopCtx?.userId,
      items: validItems.map(({ li, index }) => ({
        productId: li.productId!,
        quantity: state.totals.lineItems[index]?.quantity ?? li.quantity,
        agreedPricePaise: li.unitPricePaise,
      })),
    });

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
  }, []);

  const handleUpiCancel = useCallback(() => {
    setShowUpiModal(false);
    pendingSaveRef.current = null;
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
    }
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

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 1: Header Bar — Shop name + Document type + Shortcuts hint
          Height: 40px
          ══════════════════════════════════════════════════════════════════════ */}
      <header className="h-10 min-h-[40px] bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs font-medium">
            {shopName || 'Loading...'}
          </span>
          {isComposition && (
            <span className="bg-yellow-900/50 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-semibold">
              BILL OF SUPPLY
            </span>
          )}
          {!isComposition && (
            <span className="bg-blue-900/50 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-semibold">
              TAX INVOICE
            </span>
          )}
          {pendingOnlineCount > 0 && (
            <button
              onClick={() => setShowOnlineOrders(true)}
              className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse
                         hover:bg-orange-500 transition-colors cursor-pointer"
            >
              {pendingOnlineCount} Online {pendingOnlineCount === 1 ? 'Order' : 'Orders'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-600">
          <kbd className="bg-gray-800 px-1 rounded">F2</kbd> Customer
          <kbd className="bg-gray-800 px-1 rounded">F3</kbd> Add Item
          <kbd className="bg-gray-800 px-1 rounded">F4</kbd> New Bill
          <kbd className="bg-gray-800 px-1 rounded">F5</kbd> Save
          <kbd className="bg-gray-800 px-1 rounded">F8</kbd> Payment
          <kbd className="bg-gray-800 px-1 rounded">+/-</kbd> Qty
          <kbd className="bg-gray-800 px-1 rounded">Del</kbd> Remove
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 2: Customer Search + Loyalty + Credit Badge + Photo
          Height: 52px
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="h-[52px] min-h-[52px] bg-gray-900/50 border-b border-gray-800 flex items-center px-4 gap-4">
        {/* Customer search */}
        <div className="relative flex-1 max-w-md">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs w-20">Customer</span>
            <input
              ref={customerSearchRef}
              type="text"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              placeholder="Phone number or name... (F2)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                         focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50
                         placeholder-gray-600"
            />
          </div>
          {/* Dropdown — shows avatar + credit indicator + add-new button */}
          {showCustomerDropdown && customerQuery.length >= 2 && (
            <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-56 overflow-y-auto">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelectCustomer(c)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  {/* Mini avatar */}
                  <div className="w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-500 text-[10px] font-bold">
                        {(c.name ?? c.phoneNumber).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span>
                      <span className="text-white">{c.name ?? 'Unknown'}</span>
                      <span className="text-gray-500 ml-2">{c.phoneNumber}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {c.creditBalancePaise > 0 && (
                        <span className="text-[10px] text-red-400 font-semibold">
                          {formatINR(c.creditBalancePaise)} due
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{c.segment}</span>
                    </span>
                  </div>
                </button>
              ))}
              {/* Add New Customer button — always at bottom of dropdown */}
              <button
                onMouseDown={() => {
                  setShowCustomerDropdown(false);
                  setShowCreateCustomer(true);
                }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-700
                           border-t border-gray-700 flex items-center gap-2 text-orange-400"
              >
                <span className="w-6 h-6 rounded-full bg-orange-900/40 border border-orange-700
                               flex items-center justify-center flex-shrink-0 text-xs">
                  +
                </span>
                <span>
                  Add new customer{customerQuery ? ': ' : ''}
                  {customerQuery && (
                    <span className="text-white font-medium">{customerQuery}</span>
                  )}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Selected customer info — enhanced with avatar + credit badge */}
        {state.customer && (
          <div className="flex items-center gap-3">
            {/* Avatar — photo or initials */}
            <div
              className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden
                         flex-shrink-0 flex items-center justify-center cursor-pointer
                         hover:border-orange-500 transition-colors"
              title="Click to upload photo (optional)"
              onClick={() => customerPhotoRef.current?.click()}
            >
              {state.customer.photoUrl ? (
                <img src={state.customer.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 text-xs font-bold">
                  {(state.customer.name ?? state.customer.phoneNumber)
                    .split(' ')
                    .map((w) => w.charAt(0))
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            {/* Hidden file input for optional photo upload */}
            <input
              ref={customerPhotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !state.customer) return;
                const { error: uploadErr } = await uploadCustomerImage(file, shopId, state.customer.id);
                if (uploadErr) {
                  setValidationErrors([uploadErr]);
                  setTimeout(() => setValidationErrors([]), 4000);
                } else {
                  // Refresh customer data to get new photo URL
                  const updated = await refreshCustomer(shopId, state.customer!.id);
                  if (updated) actions.setCustomer(updated);
                  setSaveSuccess('Photo uploaded!');
                  setTimeout(() => setSaveSuccess(false), 3000);
                }
                // Reset file input
                e.target.value = '';
              }}
            />

            <div className="text-sm">
              <span className="text-white font-medium">{state.customer.name}</span>
              <span className="text-gray-500 text-xs ml-2">{state.customer.phoneNumber}</span>
              {state.customer.gstin && (
                <span className="text-blue-400 text-xs ml-2 font-mono">{state.customer.gstin}</span>
              )}
            </div>

            {/* B2B GSTIN toggle */}
            {!showGstinInput ? (
              <button
                onClick={() => setShowGstinInput(true)}
                className="px-2 py-0.5 text-[10px] font-semibold rounded border
                           border-blue-800 text-blue-400 bg-blue-900/30
                           hover:bg-blue-800/50 transition-colors"
              >
                {state.customer.gstin ? 'Edit GSTIN' : 'B2B'}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  maxLength={15}
                  placeholder="15-digit GSTIN"
                  value={gstinDraft}
                  onChange={(e) => setGstinDraft(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = gstinDraft.trim();
                      if (val.length === 0) {
                        actions.setBuyerGstin(null);
                        setShowGstinInput(false);
                      } else if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/.test(val)) {
                        actions.setBuyerGstin(val);
                        setShowGstinInput(false);
                      } else {
                        setValidationErrors(['Invalid GSTIN format — must be 15 chars like 27AAPFU0939F1ZV']);
                        setTimeout(() => setValidationErrors([]), 3000);
                      }
                    } else if (e.key === 'Escape') {
                      setShowGstinInput(false);
                      setGstinDraft(state.customer?.gstin ?? '');
                    }
                  }}
                  className="w-[140px] px-2 py-0.5 text-xs font-mono rounded
                             bg-gray-800 border border-blue-700 text-white
                             placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    const val = gstinDraft.trim();
                    if (val.length === 0) {
                      actions.setBuyerGstin(null);
                      setShowGstinInput(false);
                    } else if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/.test(val)) {
                      actions.setBuyerGstin(val);
                      setShowGstinInput(false);
                    } else {
                      setValidationErrors(['Invalid GSTIN format — must be 15 chars like 27AAPFU0939F1ZV']);
                      setTimeout(() => setValidationErrors([]), 3000);
                    }
                  }}
                  className="text-emerald-400 text-xs hover:text-emerald-300"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowGstinInput(false);
                    setGstinDraft(state.customer?.gstin ?? '');
                  }}
                  className="text-gray-500 text-xs hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Loyalty points badge */}
            <div className="bg-emerald-900/50 border border-emerald-800 rounded px-2.5 py-1">
              <span className="text-emerald-400 text-xs font-semibold">
                {state.customer.loyaltyPoints} pts
              </span>
            </div>

            {/* Credit (Udhaar) badge — only if owes money */}
            {state.customer.creditBalancePaise > 0 && (
              <>
                <div className="bg-red-900/50 border border-red-800 rounded px-2.5 py-1">
                  <span className="text-red-400 text-xs font-semibold">
                    {formatINR(state.customer.creditBalancePaise)} due
                  </span>
                </div>
                <button
                  onClick={() => setShowRepaymentModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-yellow-900/50
                             border border-yellow-800 text-yellow-400
                             hover:bg-yellow-800/50 transition-colors"
                >
                  Settle Udhaar
                </button>
              </>
            )}

            <button
              onClick={() => {
                actions.setCustomer(null);
                setCustomerQuery('');
                setGstinDraft('');
                setShowGstinInput(false);
              }}
              className="text-gray-600 hover:text-red-400 text-xs"
            >
              Clear
            </button>
          </div>
        )}

        {!state.customer && (
          <span className="text-gray-600 text-xs">Walk-in customer</span>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 3: Product Search / Add Item Bar
          Height: 44px
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="h-11 min-h-[44px] bg-gray-900/30 border-b border-gray-800 flex items-center px-4 gap-4">
        <div className="relative flex-1 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs w-20">Add Item</span>
            <input
              ref={productSearchRef}
              type="text"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredProducts.length > 0) {
                  e.preventDefault();
                  handleAddProduct(filteredProducts[0]);
                }
              }}
              placeholder="Search product, SKU, or HSN... (F3)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                         focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50
                         placeholder-gray-600"
            />
          </div>
          {showProductDropdown && filteredProducts.length > 0 && (
            <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-48 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => handleAddProduct(p)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center"
                >
                  <div>
                    <span className="text-white">{p.name}</span>
                    <span className="text-gray-600 text-xs ml-2">HSN: {p.hsn_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-orange-400 text-xs font-medium">
                      {formatINR(p.selling_price_paise)}
                    </span>
                    <span className="text-gray-600 text-xs ml-2">{p.gst_rate_percent}%</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-gray-700 text-[10px]">
          {state.lineItems.length} item{state.lineItems.length !== 1 ? 's' : ''} in bill
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 4: Line Items Grid — flex-1 takes remaining space
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Grid header */}
        <div className="h-8 min-h-[32px] bg-gray-900 border-b border-gray-800 flex items-center px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="w-7 text-center">#</span>
          <span className="flex-1 min-w-0">Item Name</span>
          <span className="w-20 text-center">HSN</span>
          <span className="w-16 text-center">Qty</span>
          <span className="w-20 text-right">Rate</span>
          {!isComposition && <span className="w-12 text-center">Tax%</span>}
          {!isComposition && <span className="w-20 text-right">Tax</span>}
          <span className="w-24 text-right pr-1">Total</span>
          <span className="w-7"></span>
        </div>

        {/* Grid body */}
        <div className="flex-1 overflow-y-auto">
          {state.lineItems.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-700 text-sm">
              Press <kbd className="bg-gray-800 px-1.5 py-0.5 rounded mx-1 text-xs">F3</kbd> to add items
              or scan a barcode
            </div>
          )}

          {state.lineItems.map((item, index) => {
            const computed = state.totals.lineItems[index];
            const isActive = index === state.activeLineIndex;
            const taxTotal = computed
              ? computed.cgstPaise + computed.sgstPaise + computed.igstPaise
              : 0;

            return (
              <div
                key={item.id}
                onClick={() => actions.setActiveLine(index)}
                className={`h-10 flex items-center px-3 text-sm border-b border-gray-800/50 cursor-pointer
                  transition-colors duration-75
                  ${isActive
                    ? 'bg-orange-950/30 border-l-2 border-l-orange-500'
                    : 'hover:bg-gray-900/50 border-l-2 border-l-transparent'
                  }`}
              >
                <span className="w-7 text-center text-gray-600 text-xs">{index + 1}</span>
                <span className="flex-1 min-w-0 truncate text-white font-medium">
                  {item.productName}
                </span>
                <span className="w-20 text-center text-gray-500 text-xs font-mono">
                  {item.hsnCode}
                </span>
                <span className="w-16 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); actions.decrementQuantity(index); }}
                      className="text-gray-600 hover:text-white text-xs w-4"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => actions.updateQuantity(index, parseFloat(e.target.value) || 1)}
                      className="w-8 bg-transparent text-center text-white text-sm
                                 focus:outline-none focus:bg-gray-800 rounded
                                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); actions.incrementQuantity(index); }}
                      className="text-gray-600 hover:text-white text-xs w-4"
                    >
                      +
                    </button>
                  </div>
                </span>
                <span className="w-20 text-right text-gray-300 font-mono text-xs">
                  {formatINR(item.unitPricePaise)}
                </span>
                {!isComposition && (
                  <span className="w-12 text-center text-gray-500 text-xs">
                    {item.gstRatePercent}%
                  </span>
                )}
                {!isComposition && (
                  <span className="w-20 text-right text-gray-500 font-mono text-xs">
                    {formatINR(taxTotal)}
                  </span>
                )}
                <span className="w-24 text-right pr-1 text-white font-semibold font-mono text-sm">
                  {formatINR(computed?.totalPaise ?? 0)}
                </span>
                <span className="w-7 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); actions.removeLineItem(index); }}
                    className="text-gray-700 hover:text-red-400 text-xs"
                  >
                    x
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 5: Totals Bar + Payment + Actions
          Height: 120px (fixed)
          ══════════════════════════════════════════════════════════════════════ */}
      <footer className="h-[120px] min-h-[120px] bg-gray-900 border-t border-gray-700">
        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="absolute bottom-[124px] left-4 right-4 bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300">
            {validationErrors.map((err, i) => <div key={i}>{err}</div>)}
          </div>
        )}
        {saveSuccess && (
          <div className="absolute bottom-[124px] left-4 right-4 bg-emerald-950 border border-emerald-800 rounded p-2 text-xs text-emerald-300">
            {saveSuccess}
          </div>
        )}
        {lowStockWarning && (
          <div className="absolute bottom-[124px] left-4 right-4 bg-amber-950 border border-amber-800 rounded p-2 text-xs text-amber-300">
            {lowStockWarning}
          </div>
        )}

        <div className="h-full flex items-center px-4 gap-6">
          {/* Totals breakdown (left side) */}
          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-0.5 text-xs max-w-md">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatINR(state.totals.subtotalPaise)}</span>
            </div>
            {!isComposition && (
              <>
                <div className="flex justify-between text-gray-400">
                  <span>CGST</span>
                  <span className="font-mono">{formatINR(state.totals.cgstTotalPaise)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>SGST</span>
                  <span className="font-mono">{formatINR(state.totals.sgstTotalPaise)}</span>
                </div>
                {state.totals.igstTotalPaise > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>IGST</span>
                    <span className="font-mono">{formatINR(state.totals.igstTotalPaise)}</span>
                  </div>
                )}
              </>
            )}
            {isComposition && (
              <div className="flex justify-between text-yellow-600">
                <span>Tax (Composition)</span>
                <span className="font-mono">Incl.</span>
              </div>
            )}
            {state.totals.discountPaise > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>Discount</span>
                <span className="font-mono">-{formatINR(state.totals.discountPaise)}</span>
              </div>
            )}
            {state.totals.roundOffPaise !== 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Round Off</span>
                <span className="font-mono">
                  {state.totals.roundOffPaise > 0 ? '+' : ''}
                  {formatINR(Math.abs(state.totals.roundOffPaise))}
                </span>
              </div>
            )}
          </div>

          {/* Grand total (center) */}
          <div className="flex flex-col items-center justify-center px-8">
            <span className="text-gray-500 text-[10px] uppercase tracking-widest">Total</span>
            <span className="text-4xl font-bold text-white font-mono tracking-tight">
              {formatINR(state.totals.totalPaise)}
            </span>
          </div>

          {/* Payment mode + action buttons (right side) */}
          <div className="flex items-center gap-3">
            {/* Payment mode selector */}
            <button
              onClick={handleCyclePayment}
              className={`px-4 py-3 rounded-lg text-sm font-semibold min-w-[90px] text-center transition-colors
                ${state.paymentMode === 'cash'
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : state.paymentMode === 'upi'
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                  : state.paymentMode === 'card'
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                  : 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'
                }`}
            >
              {PAYMENT_LABELS[state.paymentMode]}
              <div className="text-[9px] opacity-60 mt-0.5">F8 to change</div>
            </button>

            {/* New bill */}
            <button
              onClick={actions.clearBill}
              className="px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm
                         border border-gray-700 transition-colors"
            >
              New Bill
              <div className="text-[9px] text-gray-600 mt-0.5">F4</div>
            </button>

            {/* Reserve as Sales Order */}
            <button
              onClick={handleReserveSO}
              disabled={state.lineItems.length === 0 || isReserving || isSaving}
              className="px-4 py-3 rounded-lg text-sm font-medium
                         bg-blue-900/40 text-blue-300 border border-blue-700/50
                         hover:bg-blue-900/60 disabled:bg-gray-800
                         disabled:text-gray-600 disabled:border-gray-700 transition-colors"
            >
              {isReserving ? 'Reserving...' : 'Reserve (SO)'}
              <div className="text-[9px] opacity-60 mt-0.5">Sales Order</div>
            </button>

            {/* Save & Print */}
            <button
              onClick={handleSaveBill}
              disabled={state.lineItems.length === 0 || isSaving}
              className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800
                         disabled:text-gray-600 text-white text-sm font-semibold
                         border border-orange-500 disabled:border-gray-700 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save & Print'}
              <div className="text-[9px] opacity-70 mt-0.5">F5</div>
            </button>
          </div>
        </div>
      </footer>

      {/* Hidden iframe for thermal print — loads /receipt/[id] and auto-prints */}
      <iframe
        ref={printFrameRef}
        style={{ display: 'none', width: 0, height: 0 }}
        title="Print Receipt"
      />

      {/* ── UPI Payment Modal ── */}
      <PaymentModal
        isOpen={showUpiModal}
        totalPaise={state.totals.totalPaise}
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
        onSave={async (name, phone, photoFile) => {
          setIsCreatingCustomer(true);
          const { customer, error: createErr } = await createNewCustomer(
            shopId,
            name,
            phone,
            photoFile
          );
          setIsCreatingCustomer(false);

          if (createErr || !customer) {
            setValidationErrors([createErr ?? 'Failed to create customer']);
            setTimeout(() => setValidationErrors([]), 5000);
            return;
          }

          // Close modal + set as active customer
          setShowCreateCustomer(false);
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
