// =============================================================================
// BharatGrowth — Billing State Management (React Context + useReducer)
// Zero-dependency state for the speed-billing page
// =============================================================================

import { useReducer, useCallback } from 'react';
import type { GstType, GstRatePercent, PaymentMode, Customer, Product } from '@/lib/types/database';
import { calculateTotals, type LineItemInput, type InvoiceTotals } from './calculateTotals';

// ── Billing Line Item (UI state) ──

export interface BillingLineItem {
  id: string;               // Temporary UI ID
  productId: string | null;
  productName: string;
  hsnCode: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: GstRatePercent;
  discountPaise: number;
  unit: string;
  barcode: string | null;
}

// ── Customer Selection ──

export interface SelectedCustomer {
  id: string;
  phoneNumber: string;
  name: string | null;
  loyaltyPoints: number;
  gstin: string | null;
  segment: string;
}

// ── Billing State ──

export interface BillingState {
  customer: SelectedCustomer | null;
  lineItems: BillingLineItem[];
  activeLineIndex: number;          // Which row is focused in the grid
  paymentMode: PaymentMode;
  invoiceLevelDiscountPaise: number;
  isInterState: boolean;
  gstType: GstType;
  shopStateCode: string;
  totals: InvoiceTotals;
}

// ── Actions ──

type BillingAction =
  | { type: 'SET_CUSTOMER'; customer: SelectedCustomer | null }
  | { type: 'ADD_LINE_ITEM'; product: Product }
  | { type: 'ADD_LINE_ITEM_BY_BARCODE'; product: Product }
  | { type: 'REMOVE_LINE_ITEM'; index: number }
  | { type: 'UPDATE_QUANTITY'; index: number; quantity: number }
  | { type: 'UPDATE_DISCOUNT'; index: number; discountPaise: number }
  | { type: 'SET_ACTIVE_LINE'; index: number }
  | { type: 'SET_PAYMENT_MODE'; mode: PaymentMode }
  | { type: 'SET_INVOICE_DISCOUNT'; discountPaise: number }
  | { type: 'SET_INTER_STATE'; isInterState: boolean }
  | { type: 'CLEAR_BILL' }
  | { type: 'INCREMENT_QUANTITY'; index: number }
  | { type: 'DECREMENT_QUANTITY'; index: number };

// ── Helpers ──

let lineItemCounter = 0;
function nextLineId(): string {
  return `li-${++lineItemCounter}-${Date.now()}`;
}

function recalculate(state: BillingState): BillingState {
  const inputs: LineItemInput[] = state.lineItems.map((li) => ({
    productName: li.productName,
    hsnCode: li.hsnCode,
    quantity: li.quantity,
    unitPricePaise: li.unitPricePaise,
    gstRatePercent: li.gstRatePercent,
    discountPaise: li.discountPaise,
    unit: li.unit,
  }));

  const totals = calculateTotals(
    inputs,
    state.gstType,
    state.isInterState,
    state.invoiceLevelDiscountPaise
  );

  return { ...state, totals };
}

function productToLineItem(product: Product): BillingLineItem {
  return {
    id: nextLineId(),
    productId: product.id,
    productName: product.name,
    hsnCode: product.hsn_code,
    quantity: 1,
    unitPricePaise: product.selling_price_paise,
    gstRatePercent: product.gst_rate_percent,
    discountPaise: 0,
    unit: product.unit,
    barcode: product.barcode,
  };
}

// ── Reducer ──

function billingReducer(state: BillingState, action: BillingAction): BillingState {
  switch (action.type) {
    case 'SET_CUSTOMER':
      return { ...state, customer: action.customer };

    case 'ADD_LINE_ITEM':
    case 'ADD_LINE_ITEM_BY_BARCODE': {
      // If product already exists in list, increment its quantity
      const existingIdx = state.lineItems.findIndex(
        (li) => li.productId === action.product.id
      );
      if (existingIdx !== -1) {
        const updated = [...state.lineItems];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return recalculate({
          ...state,
          lineItems: updated,
          activeLineIndex: existingIdx,
        });
      }
      const newItem = productToLineItem(action.product);
      const newItems = [...state.lineItems, newItem];
      return recalculate({
        ...state,
        lineItems: newItems,
        activeLineIndex: newItems.length - 1,
      });
    }

    case 'REMOVE_LINE_ITEM': {
      const filtered = state.lineItems.filter((_, i) => i !== action.index);
      return recalculate({
        ...state,
        lineItems: filtered,
        activeLineIndex: Math.min(state.activeLineIndex, Math.max(0, filtered.length - 1)),
      });
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) return state;
      const updated = [...state.lineItems];
      updated[action.index] = { ...updated[action.index], quantity: action.quantity };
      return recalculate({ ...state, lineItems: updated });
    }

    case 'INCREMENT_QUANTITY': {
      const updated = [...state.lineItems];
      updated[action.index] = {
        ...updated[action.index],
        quantity: updated[action.index].quantity + 1,
      };
      return recalculate({ ...state, lineItems: updated });
    }

    case 'DECREMENT_QUANTITY': {
      const updated = [...state.lineItems];
      const current = updated[action.index].quantity;
      if (current <= 1) return state;
      updated[action.index] = { ...updated[action.index], quantity: current - 1 };
      return recalculate({ ...state, lineItems: updated });
    }

    case 'UPDATE_DISCOUNT': {
      const updated = [...state.lineItems];
      updated[action.index] = { ...updated[action.index], discountPaise: action.discountPaise };
      return recalculate({ ...state, lineItems: updated });
    }

    case 'SET_ACTIVE_LINE':
      return { ...state, activeLineIndex: action.index };

    case 'SET_PAYMENT_MODE':
      return { ...state, paymentMode: action.mode };

    case 'SET_INVOICE_DISCOUNT':
      return recalculate({ ...state, invoiceLevelDiscountPaise: action.discountPaise });

    case 'SET_INTER_STATE':
      return recalculate({ ...state, isInterState: action.isInterState });

    case 'CLEAR_BILL':
      return recalculate({
        ...state,
        customer: null,
        lineItems: [],
        activeLineIndex: 0,
        paymentMode: 'cash',
        invoiceLevelDiscountPaise: 0,
        isInterState: false,
      });

    default:
      return state;
  }
}

// ── Hook ──

export function useBillingStore(gstType: GstType, shopStateCode: string) {
  const initialState: BillingState = {
    customer: null,
    lineItems: [],
    activeLineIndex: 0,
    paymentMode: 'cash',
    invoiceLevelDiscountPaise: 0,
    isInterState: false,
    gstType,
    shopStateCode,
    totals: {
      subtotalPaise: 0,
      cgstTotalPaise: 0,
      sgstTotalPaise: 0,
      igstTotalPaise: 0,
      discountPaise: 0,
      roundOffPaise: 0,
      totalPaise: 0,
      documentType: gstType === 'composition' ? 'bill_of_supply' : 'tax_invoice',
      lineItems: [],
    },
  };

  const [state, dispatch] = useReducer(billingReducer, initialState);

  const actions = {
    setCustomer: useCallback(
      (customer: SelectedCustomer | null) => dispatch({ type: 'SET_CUSTOMER', customer }),
      []
    ),
    addProduct: useCallback(
      (product: Product) => dispatch({ type: 'ADD_LINE_ITEM', product }),
      []
    ),
    addByBarcode: useCallback(
      (product: Product) => dispatch({ type: 'ADD_LINE_ITEM_BY_BARCODE', product }),
      []
    ),
    removeLineItem: useCallback(
      (index: number) => dispatch({ type: 'REMOVE_LINE_ITEM', index }),
      []
    ),
    updateQuantity: useCallback(
      (index: number, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', index, quantity }),
      []
    ),
    incrementQuantity: useCallback(
      (index: number) => dispatch({ type: 'INCREMENT_QUANTITY', index }),
      []
    ),
    decrementQuantity: useCallback(
      (index: number) => dispatch({ type: 'DECREMENT_QUANTITY', index }),
      []
    ),
    updateDiscount: useCallback(
      (index: number, discountPaise: number) => dispatch({ type: 'UPDATE_DISCOUNT', index, discountPaise }),
      []
    ),
    setActiveLine: useCallback(
      (index: number) => dispatch({ type: 'SET_ACTIVE_LINE', index }),
      []
    ),
    setPaymentMode: useCallback(
      (mode: PaymentMode) => dispatch({ type: 'SET_PAYMENT_MODE', mode }),
      []
    ),
    setInvoiceDiscount: useCallback(
      (discountPaise: number) => dispatch({ type: 'SET_INVOICE_DISCOUNT', discountPaise }),
      []
    ),
    setInterState: useCallback(
      (isInterState: boolean) => dispatch({ type: 'SET_INTER_STATE', isInterState }),
      []
    ),
    clearBill: useCallback(() => dispatch({ type: 'CLEAR_BILL' }), []),
  };

  return { state, actions };
}
