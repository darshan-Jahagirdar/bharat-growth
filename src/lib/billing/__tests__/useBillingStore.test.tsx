import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/types/database';
import { useBillingStore } from '../useBillingStore';

const PRODUCT: Product = {
  id: '10000000-0000-4000-8000-000000000001',
  shop_id: '20000000-0000-4000-8000-000000000001',
  name: 'MRF Test Tyre',
  sku: 'MRF-TEST',
  hsn_code: '4011',
  gst_rate_percent: 18,
  unit_price_paise: 10_000,
  selling_price_paise: 10_000,
  unit: 'piece',
  category: 'Tyres',
  tag_id: null,
  is_active: true,
  barcode: '1234567890',
  vertical_attrs: {},
  image_url: null,
  is_stock_tracked: true,
  low_stock_threshold: 2,
  purchase_price_paise: 8_000,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('useBillingStore behavior contract', () => {
  it('increments an existing product instead of adding a duplicate row', () => {
    const { result } = renderHook(() => useBillingStore('regular', '27'));

    act(() => result.current.actions.addProduct(PRODUCT));
    act(() => result.current.actions.addProduct(PRODUCT));

    expect(result.current.state.lineItems).toHaveLength(1);
    expect(result.current.state.lineItems[0].quantity).toBe(2);
    expect(result.current.state.totals.totalPaise).toBe(23_600);
  });

  it('moves tax from CGST/SGST to IGST without changing the grand total', () => {
    const { result } = renderHook(() => useBillingStore('regular', '27'));

    act(() => result.current.actions.addProduct(PRODUCT));
    const intraTotal = result.current.state.totals.totalPaise;
    act(() => result.current.actions.setInterState(true));

    expect(result.current.state.totals.totalPaise).toBe(intraTotal);
    expect(result.current.state.totals.cgstTotalPaise).toBe(0);
    expect(result.current.state.totals.sgstTotalPaise).toBe(0);
    expect(result.current.state.totals.igstTotalPaise).toBe(1_800);
  });

  it('clears customer, items, payment mode, and invoice discount', () => {
    const { result } = renderHook(() => useBillingStore('regular', '27'));

    act(() => {
      result.current.actions.addProduct(PRODUCT);
      result.current.actions.setPaymentMode('credit');
      result.current.actions.setInvoiceDiscount(100);
    });
    act(() => result.current.actions.clearBill());

    expect(result.current.state.lineItems).toEqual([]);
    expect(result.current.state.customer).toBeNull();
    expect(result.current.state.paymentMode).toBe('cash');
    expect(result.current.state.invoiceLevelDiscountPaise).toBe(0);
    expect(result.current.state.totals.totalPaise).toBe(0);
  });
});
