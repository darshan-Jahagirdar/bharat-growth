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
} from '@/lib/billing/billingQueries';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS } from '@/lib/billing/mockData';

// ── Check if Supabase is configured ──
const SUPABASE_CONFIGURED =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321' ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').length > 30;

// ── Payment mode cycle ──
const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'credit'];
const PAYMENT_LABELS: Record<PaymentMode, string> = {
  cash: '₹ Cash', upi: 'UPI', card: 'Card', credit: 'Credit', split: 'Split',
};

export default function BillingPage() {
  // Shop context (mock — will come from Supabase auth context)
  const shopId = 'a0000000-0000-0000-0000-000000000001';
  const gstType = 'regular' as const;
  const shopStateCode = '27';

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
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // ── Async search results ──
  const [filteredCustomers, setFilteredCustomers] = useState<SelectedCustomer[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // ── Customer search with debounce ──
  useEffect(() => {
    if (!customerQuery || customerQuery.length < 2) {
      setFilteredCustomers([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (SUPABASE_CONFIGURED) {
        const results = await searchCustomers(customerQuery, shopId);
        setFilteredCustomers(results);
      } else {
        // Fallback to mock data
        const q = customerQuery.toLowerCase();
        setFilteredCustomers(
          MOCK_CUSTOMERS.filter(
            (c) => c.phoneNumber.includes(q) || (c.name && c.name.toLowerCase().includes(q))
          )
        );
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [customerQuery, shopId]);

  // ── Product search with debounce ──
  useEffect(() => {
    if (!productQuery || productQuery.length < 1) {
      setFilteredProducts([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (SUPABASE_CONFIGURED) {
        const results = await searchProducts(productQuery, shopId);
        setFilteredProducts(results);
      } else {
        const q = productQuery.toLowerCase();
        setFilteredProducts(
          MOCK_PRODUCTS.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.sku && p.sku.toLowerCase().includes(q)) ||
              p.hsn_code.includes(q)
          )
        );
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [productQuery, shopId]);

  // ── Handlers ──
  const handleSelectCustomer = useCallback(
    (customer: SelectedCustomer) => {
      actions.setCustomer(customer);
      setCustomerQuery(customer.phoneNumber);
      setShowCustomerDropdown(false);
      productSearchRef.current?.focus();
    },
    [actions]
  );

  const handleAddProduct = useCallback(
    (product: Product) => {
      actions.addProduct(product);
      setProductQuery('');
      setShowProductDropdown(false);
      productSearchRef.current?.focus();
    },
    [actions]
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

  const handleSaveBill = useCallback(async () => {
    if (isSaving) return;

    // Validate with Zod before hitting DB
    const result = validateBillingState(
      state, shopId, '2025-26', 'BG/2025-26/00001', 1, 'user-mock-id'
    );
    if (!result.valid) {
      setValidationErrors(result.errors);
      setSaveSuccess(false);
      setTimeout(() => setValidationErrors([]), 4000);
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);

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
      created_by: null, // Will be auth.uid() when auth is wired
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

    // Loyalty: 1 point per ₹100 spent
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
      // ── Real Supabase RPC call (atomic transaction) ──
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

      // ── Trigger print via hidden iframe ──
      if (printFrameRef.current) {
        printFrameRef.current.src = `/receipt/${invoiceId}`;
      }

      // ── Send WhatsApp receipt (non-blocking) ──
      if (state.customer?.phoneNumber) {
        fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: state.customer.phoneNumber,
            invoice_number: invoiceNumber,
            invoice_total: state.totals.totalPaise,
            points_earned: Math.floor(state.totals.totalPaise / 10000),
            shop_name: 'Ganesh Tyres', // TODO: from shop context
          }),
        }).catch(() => {}); // Non-blocking — don't fail the bill

      }

      setTimeout(() => {
        setSaveSuccess(false);
        actions.clearBill();
      }, 3000);
    } else {
      // ── Mock save (no Supabase) ──
      await new Promise((r) => setTimeout(r, 300)); // Simulate network
      setIsSaving(false);

      const mockId = crypto.randomUUID();
      setSaveSuccess('Invoice BG/2025-26/00001 saved (mock)!');

      // ── Trigger print via hidden iframe (mock receipt won't load without DB) ──
      if (printFrameRef.current) {
        printFrameRef.current.src = `/receipt/${mockId}`;
      }

      // ── Send WhatsApp receipt (non-blocking) ──
      if (state.customer?.phoneNumber) {
        fetch('/api/whatsapp/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: state.customer.phoneNumber,
            invoice_number: 'BG/2025-26/00001',
            invoice_total: state.totals.totalPaise,
            points_earned: Math.floor(state.totals.totalPaise / 10000),
            shop_name: 'Ganesh Tyres',
          }),
        }).catch(() => {});
      }

      setTimeout(() => {
        setSaveSuccess(false);
        actions.clearBill();
      }, 3000);
    }
  }, [state, shopId, isSaving, actions]);

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
    <div className="h-[calc(100vh-28px)] w-screen bg-gray-950 text-gray-200 flex flex-col overflow-hidden select-none">
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
          <span className="text-orange-500 font-bold text-sm">BharatGrowth</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-400 text-xs font-medium">
            Ganesh Tyres — Pune
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
          ROW 2: Customer Search + Loyalty Points
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
          {/* Dropdown */}
          {showCustomerDropdown && filteredCustomers.length > 0 && (
            <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelectCustomer(c)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center"
                >
                  <span>
                    <span className="text-white">{c.name ?? 'Unknown'}</span>
                    <span className="text-gray-500 ml-2">{c.phoneNumber}</span>
                  </span>
                  <span className="text-xs text-gray-500">{c.segment}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected customer info */}
        {state.customer && (
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-white font-medium">{state.customer.name}</span>
              <span className="text-gray-500 text-xs ml-2">{state.customer.phoneNumber}</span>
            </div>
            <div className="bg-emerald-900/50 border border-emerald-800 rounded px-2.5 py-1">
              <span className="text-emerald-400 text-xs font-semibold">
                {state.customer.loyaltyPoints} pts
              </span>
            </div>
            <button
              onClick={() => {
                actions.setCustomer(null);
                setCustomerQuery('');
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
    </div>
  );
}
