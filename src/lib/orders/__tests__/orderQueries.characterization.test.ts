import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryBuilder, expectQueryCalls } from '@/test/supabaseQueryMock';
import type { CreatePOParams, CreateSOParams } from '../orderQueries';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
    ...overrides,
  };
}

function purchaseHeader(id: string) {
  return {
    id,
    po_number: `PO-${id}`,
    po_sequence: 1,
    financial_year: '2026-27',
    supplier_name: 'Supplier',
    status: 'draft',
    expected_date: null,
    total_amount_paise: 1000,
    notes: null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  };
}

describe('orderQueries characterization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mocks.createClient.mockReset();
  });

  it('fetches 50 purchase headers before items, groups joins, and preserves pagination', async () => {
    const headers = Array.from({ length: 50 }, (_, index) =>
      purchaseHeader(`po-${index + 1}`)
    );
    const headerQuery = createQueryBuilder({ data: headers, error: null });
    const itemQuery = createQueryBuilder({
      data: [
        {
          id: 'item-1',
          po_id: 'po-1',
          product_id: 'product-1',
          quantity: 2,
          expected_price_paise: 500,
          products: { name: 'Tyre', unit: 'pcs' },
        },
        {
          id: 'item-2',
          po_id: 'po-1',
          product_id: null,
          quantity: 1,
          expected_price_paise: 100,
          products: null,
        },
      ],
      error: null,
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(headerQuery)
        .mockReturnValueOnce(itemQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { fetchPurchaseOrders, PAGE_SIZE } = await import('../orderQueries');
    const result = await fetchPurchaseOrders('shop-1', 10);

    expect(PAGE_SIZE).toBe(50);
    expect(result.hasMore).toBe(true);
    expect(result.rows).toHaveLength(50);
    expect(result.rows[0].items).toEqual([
      {
        id: 'item-1',
        product_id: 'product-1',
        quantity: 2,
        expected_price_paise: 500,
        product_name: 'Tyre',
        product_unit: 'pcs',
      },
      {
        id: 'item-2',
        product_id: null,
        quantity: 1,
        expected_price_paise: 100,
        product_name: null,
        product_unit: null,
      },
    ]);
    expect(result.rows[1].items).toEqual([]);
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'purchase_orders',
      'purchase_order_items',
    ]);
    expect(expectQueryCalls(headerQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, po_number, po_sequence, financial_year, supplier_name, status, expected_date, total_amount_paise, notes, created_at, updated_at',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'range', args: [10, 59] },
    ]);
    expect(expectQueryCalls(itemQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, po_id, product_id, quantity, expected_price_paise, products:product_id(name, unit)',
        ],
      },
      {
        method: 'in',
        args: ['po_id', headers.map((header) => header.id)],
      },
    ]);
  });

  it('returns the purchase header fallback without issuing an item query', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const headerQuery = createQueryBuilder({
      data: null,
      error: { message: 'headers failed' },
    });
    const client = mockClient({ from: vi.fn().mockReturnValue(headerQuery) });
    mocks.createClient.mockReturnValue(client);

    const { fetchPurchaseOrders } = await import('../orderQueries');
    await expect(fetchPurchaseOrders('shop-1')).resolves.toEqual({
      rows: [],
      hasMore: false,
    });
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      '[Orders] PO fetch error:',
      'headers failed'
    );
  });

  it('flattens sales-order customers, groups items, and tolerates item errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const headerQuery = createQueryBuilder({
      data: [
        {
          id: 'so-1',
          so_number: 'SO-1',
          so_sequence: 1,
          financial_year: '2026-27',
          customer_id: 'customer-1',
          status: 'reserved',
          valid_until: null,
          total_amount_paise: 1200,
          notes: null,
          created_at: '2026-07-15T00:00:00Z',
          updated_at: '2026-07-15T00:00:00Z',
          customers: { name: 'Asha', phone_number: 'customer-phone' },
        },
      ],
      error: null,
    });
    const itemQuery = createQueryBuilder({
      data: null,
      error: { message: 'items failed' },
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(headerQuery)
        .mockReturnValueOnce(itemQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { fetchSalesOrders } = await import('../orderQueries');
    await expect(fetchSalesOrders('shop-1')).resolves.toEqual({
      rows: [
        {
          id: 'so-1',
          so_number: 'SO-1',
          so_sequence: 1,
          financial_year: '2026-27',
          customer_id: 'customer-1',
          customer_name: 'Asha',
          customer_phone: 'customer-phone',
          status: 'reserved',
          valid_until: null,
          total_amount_paise: 1200,
          notes: null,
          created_at: '2026-07-15T00:00:00Z',
          updated_at: '2026-07-15T00:00:00Z',
          items: [],
        },
      ],
      hasMore: false,
    });
    expect(expectQueryCalls(headerQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, so_number, so_sequence, financial_year, customer_id, status, valid_until, total_amount_paise, notes, created_at, updated_at, customers:customer_id(name, phone_number)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'range', args: [0, 49] },
    ]);
    expect(expectQueryCalls(itemQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, so_id, product_id, quantity, agreed_price_paise, products:product_id(name, unit)',
        ],
      },
      { method: 'in', args: ['so_id', ['so-1']] },
    ]);
    expect(error).toHaveBeenCalledWith(
      '[Orders] SO items fetch error:',
      'items failed'
    );
  });

  it('preserves optional conversion fields and exact create RPC payloads', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = mockClient({
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: { bill_id: 'bill-1' }, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'sales create failed' },
        })
        .mockResolvedValueOnce({ data: { po_id: 'po-1' }, error: null })
        .mockResolvedValueOnce({ data: { invoice_id: 'invoice-1' }, error: null }),
    });
    mocks.createClient.mockReturnValue(client);
    const salesParams: CreateSOParams = {
      shopId: 'shop-1',
      customerId: null,
      totalAmountPaise: 1200,
      items: [
        { productId: 'product-1', quantity: 2, agreedPricePaise: 600 },
      ],
    };
    const purchaseParams: CreatePOParams = {
      shopId: 'shop-1',
      supplierName: 'Supplier',
      expectedDate: '2026-07-20',
      totalAmountPaise: 900,
      notes: 'urgent',
      createdBy: 'user-1',
      items: [
        { productId: 'product-1', quantity: 1, expectedPricePaise: 900 },
      ],
    };

    const {
      convertPurchaseOrder,
      convertSalesOrder,
      savePurchaseOrder,
      saveSalesOrder,
    } = await import('../orderQueries');

    await expect(convertPurchaseOrder('po-1')).resolves.toEqual({
      success: true,
      data: { bill_id: 'bill-1' },
      error: null,
    });
    await expect(saveSalesOrder(salesParams)).resolves.toEqual({
      success: false,
      data: null,
      error: 'sales create failed',
    });
    await expect(savePurchaseOrder(purchaseParams)).resolves.toEqual({
      success: true,
      data: { po_id: 'po-1' },
      error: null,
    });
    await expect(convertSalesOrder('so-1', 'upi')).resolves.toEqual({
      success: true,
      data: { invoice_id: 'invoice-1' },
      error: null,
    });

    expect(client.rpc.mock.calls).toEqual([
      ['convert_po_to_bill', { p_po_id: 'po-1' }],
      [
        'create_sales_order',
        {
          p_order: {
            shop_id: 'shop-1',
            customer_id: null,
            total_amount_paise: 1200,
            notes: null,
            created_by: null,
          },
          p_items: [
            {
              product_id: 'product-1',
              quantity: 2,
              agreed_price_paise: 600,
            },
          ],
        },
      ],
      [
        'create_purchase_order',
        {
          p_order: {
            shop_id: 'shop-1',
            supplier_name: 'Supplier',
            expected_date: '2026-07-20',
            total_amount_paise: 900,
            notes: 'urgent',
            created_by: 'user-1',
          },
          p_items: [
            {
              product_id: 'product-1',
              quantity: 1,
              expected_price_paise: 900,
            },
          ],
        },
      ],
      [
        'convert_so_to_invoice',
        { p_so_id: 'so-1', p_payment_mode: 'upi' },
      ],
    ]);
    expect(error).toHaveBeenCalledWith(
      '[Orders] create_sales_order error:',
      'sales create failed'
    );
  });

  it('includes a bill number only when supplied', async () => {
    const client = mockClient({
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });
    mocks.createClient.mockReturnValue(client);
    const { convertPurchaseOrder } = await import('../orderQueries');

    await convertPurchaseOrder('po-2', 'BILL-9');
    expect(client.rpc).toHaveBeenCalledWith('convert_po_to_bill', {
      p_po_id: 'po-2',
      p_bill_number: 'BILL-9',
    });
  });

  it('guards cancellations by tenant and status and distinguishes no-match from query errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const salesQuery = createQueryBuilder({
      data: [{ id: 'so-1' }],
      error: null,
    });
    const purchaseQuery = createQueryBuilder({ data: [], error: null });
    const failedSalesQuery = createQueryBuilder({
      data: null,
      error: { message: 'update failed' },
    });
    const client = mockClient({
      from: vi
        .fn()
        .mockReturnValueOnce(salesQuery)
        .mockReturnValueOnce(purchaseQuery)
        .mockReturnValueOnce(failedSalesQuery),
    });
    mocks.createClient.mockReturnValue(client);

    const { cancelPurchaseOrder, cancelSalesOrder } = await import(
      '../orderQueries'
    );

    await expect(cancelSalesOrder('so-1', 'shop-1')).resolves.toEqual({
      success: true,
      data: null,
      error: null,
    });
    await expect(cancelPurchaseOrder('po-1', 'shop-1')).resolves.toEqual({
      success: false,
      data: null,
      error: 'Order cannot be cancelled (already fulfilled or cancelled)',
    });
    await expect(cancelSalesOrder('so-2', 'shop-1')).resolves.toEqual({
      success: false,
      data: null,
      error: 'update failed',
    });

    expect(expectQueryCalls(salesQuery)).toEqual([
      { method: 'update', args: [{ status: 'cancelled' }] },
      { method: 'eq', args: ['id', 'so-1'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'in', args: ['status', ['draft', 'reserved']] },
      { method: 'select', args: ['id'] },
    ]);
    expect(expectQueryCalls(purchaseQuery)).toEqual([
      { method: 'update', args: [{ status: 'cancelled' }] },
      { method: 'eq', args: ['id', 'po-1'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'in', args: ['status', ['draft', 'sent']] },
      { method: 'select', args: ['id'] },
    ]);
    expect(error).toHaveBeenCalledWith(
      '[Orders] cancelSalesOrder error:',
      'update failed'
    );
  });
});
