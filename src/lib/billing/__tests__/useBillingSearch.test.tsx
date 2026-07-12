import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types/database';
import type { SelectedCustomer } from '../useBillingStore';
import { searchCustomers, searchProducts } from '../billingQueries';
import { useBillingSearch } from '../useBillingSearch';

vi.mock('../billingQueries', () => ({
  searchCustomers: vi.fn(),
  searchProducts: vi.fn(),
}));

const CUSTOMER_A: SelectedCustomer = {
  id: 'customer-a',
  phoneNumber: '9000000001',
  name: 'Customer A',
  loyaltyPoints: 0,
  gstin: null,
  segment: 'regular',
  creditBalancePaise: 0,
  photoUrl: null,
};

const CUSTOMER_B: SelectedCustomer = {
  ...CUSTOMER_A,
  id: 'customer-b',
  phoneNumber: '9000000002',
  name: 'Customer B',
};

const PRODUCT: Product = {
  id: 'product-1',
  shop_id: 'shop-1',
  name: 'Test product',
  sku: 'TEST-1',
  hsn_code: '4011',
  gst_rate_percent: 18,
  unit_price_paise: 10_000,
  selling_price_paise: 10_000,
  unit: 'piece',
  category: null,
  tag_id: null,
  is_active: true,
  barcode: null,
  vertical_attrs: {},
  image_url: null,
  is_stock_tracked: true,
  low_stock_threshold: 5,
  purchase_price_paise: 8_000,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('billing search behavior contract', () => {
  it('waits 350ms before customer search and does not query for fewer than two characters', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([CUSTOMER_A]);
    const { result } = renderHook(() => useBillingSearch({
      shopId: 'shop-1',
      supabaseConfigured: true,
      demoMode: false,
    }));

    act(() => result.current.setCustomerQuery('a'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(searchCustomers).not.toHaveBeenCalled();

    act(() => result.current.setCustomerQuery('ab'));
    await act(() => vi.advanceTimersByTimeAsync(349));
    expect(searchCustomers).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(searchCustomers).toHaveBeenCalledWith('ab', 'shop-1');
  });

  it('prevents a slow customer response from overwriting a newer query', async () => {
    const first = deferred<SelectedCustomer[]>();
    const second = deferred<SelectedCustomer[]>();
    vi.mocked(searchCustomers)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useBillingSearch({
      shopId: 'shop-1',
      supabaseConfigured: true,
      demoMode: false,
    }));

    act(() => result.current.setCustomerQuery('first'));
    await act(() => vi.advanceTimersByTimeAsync(350));
    act(() => result.current.setCustomerQuery('second'));
    await act(() => vi.advanceTimersByTimeAsync(350));

    await act(async () => second.resolve([CUSTOMER_B]));
    expect(result.current.filteredCustomers).toEqual([CUSTOMER_B]);

    await act(async () => first.resolve([CUSTOMER_A]));
    expect(result.current.filteredCustomers).toEqual([CUSTOMER_B]);
  });

  it('waits 100ms before product search and publishes the latest result', async () => {
    vi.mocked(searchProducts).mockResolvedValue([PRODUCT]);
    const { result } = renderHook(() => useBillingSearch({
      shopId: 'shop-1',
      supabaseConfigured: true,
      demoMode: false,
    }));

    act(() => result.current.setProductQuery('tyre'));
    await act(() => vi.advanceTimersByTimeAsync(99));
    expect(searchProducts).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(searchProducts).toHaveBeenCalledWith('tyre', 'shop-1');
    expect(result.current.filteredProducts).toEqual([PRODUCT]);
  });
});
