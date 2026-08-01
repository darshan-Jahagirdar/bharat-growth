import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryBuilder,
  expectQueryCalls,
  type QueryBuilder,
} from '@/test/supabaseQueryMock';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

const GST_SELECT = `
      id,
      invoice_number,
      created_at,
      total_paise,
      payment_mode,
      customer_gstin,
      customers ( name, phone_number ),
      invoice_items (
        product_name,
        hsn_code,
        quantity,
        taxable_amount_paise,
        cgst_paise,
        sgst_paise,
        igst_paise,
        total_paise
      )
    `;

function queuedClient(queues: Record<string, QueryBuilder[]>) {
  const from = vi.fn((table: string) => {
    const builder = queues[table]?.shift();
    if (!builder) throw new Error(`Missing query builder for ${table}`);
    return builder;
  });
  return { from, rpc: vi.fn() };
}

describe('dashboardQueries characterization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    mocks.createClient.mockReset();
  });

  it('orchestrates all dashboard reads in parallel with exact IST ranges and shaping', async () => {
    const salesQuery = createQueryBuilder({
      data: [{ total_paise: 1000 }, { total_paise: 2500 }],
      error: null,
    });
    const purchaseQuery = createQueryBuilder({
      data: [{ total_value_paise: 700 }, { total_value_paise: null }],
      error: null,
    });
    const todayQuery = createQueryBuilder({
      data: [
        { total_paise: 100 },
        { total_paise: null },
        { total_paise: 250 },
      ],
      error: null,
    });
    const creditQuery = createQueryBuilder({
      data: [{ credit_balance_paise: 500 }, { credit_balance_paise: null }],
      error: null,
    });
    const inventoryValueQuery = createQueryBuilder({
      data: [
        {
          quantity_in_stock: 2,
          products: { selling_price_paise: 1000 },
        },
      ],
      error: null,
    });
    const stockCostQuery = createQueryBuilder({
      data: [
        {
          quantity_in_stock: 2,
          products: { purchase_price_paise: 400 },
        },
      ],
      error: null,
    });
    const trendQuery = createQueryBuilder({
      data: [
        { total_paise: 155, created_at: '2026-07-15T00:00:00.000Z' },
      ],
      error: null,
    });
    const topProductsQuery = createQueryBuilder({
      data: [
        {
          product_name: 'Very Long Product Name',
          taxable_amount_paise: 255,
          invoices: { status: 'completed' },
        },
        {
          product_name: 'Very Long Product Name',
          taxable_amount_paise: 145,
          invoices: { status: 'completed' },
        },
        {
          product_name: 'Short',
          taxable_amount_paise: 1000,
          invoices: { status: 'completed' },
        },
        {
          product_name: 'Ignored',
          taxable_amount_paise: 9999,
          invoices: { status: 'draft' },
        },
      ],
      error: null,
    });
    const captureInvoicesQuery = createQueryBuilder({
      data: [
        { customer_id: 'customer-1' },
        { customer_id: null },
        { customer_id: 'customer-2' },
      ],
      error: null,
    });
    const captureVisitsQuery = createQueryBuilder({
      data: [{ id: 'visit-1' }, { id: 'visit-2' }],
      error: null,
    });
    const khataRows = [
      {
        id: 'customer-1',
        name: 'Asha',
        phone_number: 'customer-phone',
        photo_url: null,
        credit_balance_paise: 900,
        last_visit_at: null,
      },
    ];
    const khataQuery = createQueryBuilder({ data: khataRows, error: null });
    const lowStockQuery = createQueryBuilder({
      data: [
        {
          id: 'inventory-1',
          quantity_in_stock: '3',
          reorder_level: 0,
          products: {
            id: 'product-1',
            name: 'Tracked Tyre',
            unit: 'pcs',
            is_active: true,
          },
        },
        {
          id: 'inventory-2',
          quantity_in_stock: 1,
          reorder_level: 4,
          products: {
            id: 'product-2',
            name: 'Inactive',
            unit: 'pcs',
            is_active: false,
          },
        },
      ],
      error: null,
    });
    const negativeStockQuery = createQueryBuilder({
      data: [
        {
          id: 'inventory-3',
          product_id: 'product-3',
          quantity_in_stock: '-2',
          products: {
            name: 'Negative Tyre',
            unit: 'pcs',
            is_stock_tracked: true,
          },
        },
        {
          id: 'inventory-4',
          product_id: 'product-4',
          quantity_in_stock: -1,
          products: {
            name: 'Untracked',
            unit: 'pcs',
            is_stock_tracked: false,
          },
        },
      ],
      error: null,
    });
    const queues = {
      invoices: [
        salesQuery,
        todayQuery,
        trendQuery,
        captureInvoicesQuery,
      ],
      inventory_movements: [purchaseQuery],
      customers: [creditQuery, khataQuery],
      inventory: [
        inventoryValueQuery,
        stockCostQuery,
        lowStockQuery,
        negativeStockQuery,
      ],
      invoice_items: [topProductsQuery],
      customer_visits: [captureVisitsQuery],
    };
    const client = queuedClient(queues);
    client.rpc.mockResolvedValue({
      data: {
        messages_sent: 8,
        customers_returned: 3,
        revenue_attributed_paise: 4200,
        active_rules_count: 1,
        per_rule: [
          {
            rule_id: 'rule-1',
            rule_name: 'Win Back',
            tag_name: 'Dormant',
            is_active: true,
            sent: 8,
            returned: 3,
            revenue_paise: 4200,
          },
        ],
      },
      error: null,
    });
    mocks.createClient.mockReturnValue(client);

    const { fetchAllDashboardData } = await import('../dashboardQueries');
    const result = await fetchAllDashboardData('shop-1', {
      start: '2026-06-01T00:00:00+05:30',
      end: '2026-06-30T23:59:59+05:30',
    });

    expect(result.kpis).toEqual({
      todayRevenuePaise: 350,
      totalUdhaarPaise: 500,
      billsToday: 3,
      inventoryValuePaise: 2000,
      monthlySalesPaise: 3500,
      monthlyPurchasesPaise: 700,
      stockValueCostPaise: 800,
    });
    expect(result.revenueTrend).toHaveLength(7);
    expect(result.revenueTrend.at(-1)).toEqual({
      date: 'Wed',
      fullDate: '15 Jul',
      revenue: 2,
    });
    expect(result.topProducts).toEqual([
      { name: 'Short', sales: 10 },
      { name: 'Very Long Produc...', sales: 4 },
    ]);
    expect(result.khataCustomers).toEqual(khataRows);
    expect(result.lowStockProducts).toEqual([
      {
        id: 'product-1',
        name: 'Tracked Tyre',
        quantity_in_stock: 3,
        unit: 'pcs',
        reorder_level: null,
      },
    ]);
    expect(result.negativeStockProducts).toEqual([
      {
        product_id: 'product-3',
        inventory_id: 'inventory-3',
        name: 'Negative Tyre',
        quantity_in_stock: -2,
        unit: 'pcs',
      },
    ]);
    expect(result.retentionStats).toEqual({
      messagesSent: 8,
      customersReturned: 3,
      revenueAttributedPaise: 4200,
      activeRulesCount: 1,
      perRule: [
        {
          ruleId: 'rule-1',
          ruleName: 'Win Back',
          tagName: 'Dormant',
          isActive: true,
          sent: 8,
          returned: 3,
          revenuePaise: 4200,
        },
      ],
    });
    expect(result.captureMetrics).toEqual({
      billsWithCustomerPercent: 67,
      customerCaptures: 4,
      identifiedBills: 2,
      totalBills: 3,
      visits: 2,
    });

    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'invoices',
      'inventory_movements',
      'invoices',
      'customers',
      'inventory',
      'inventory',
      'invoices',
      'invoice_items',
      'customers',
      'inventory',
      'inventory',
      'invoices',
      'customer_visits',
    ]);
    expect(expectQueryCalls(salesQuery)).toEqual([
      { method: 'select', args: ['total_paise'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(purchaseQuery)).toEqual([
      { method: 'select', args: ['total_value_paise'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['movement_type', 'purchase'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(todayQuery)).toEqual([
      { method: 'select', args: ['total_paise'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-07-15T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-07-15T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(creditQuery)).toEqual([
      { method: 'select', args: ['credit_balance_paise'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'gt', args: ['credit_balance_paise', 0] },
    ]);
    expect(expectQueryCalls(inventoryValueQuery)).toEqual([
      {
        method: 'select',
        args: ['quantity_in_stock, products!inner(selling_price_paise)'],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'gt', args: ['quantity_in_stock', 0] },
    ]);
    expect(expectQueryCalls(stockCostQuery)).toEqual([
      {
        method: 'select',
        args: ['quantity_in_stock, products!inner(purchase_price_paise)'],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'gt', args: ['quantity_in_stock', 0] },
    ]);
    expect(expectQueryCalls(trendQuery)).toEqual([
      { method: 'select', args: ['total_paise, created_at'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-07-09T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-07-15T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(topProductsQuery)).toEqual([
      {
        method: 'select',
        args: [
          'product_name, taxable_amount_paise, invoices!inner(status, created_at)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      {
        method: 'gte',
        args: ['invoices.created_at', '2026-07-01T00:00:00+05:30'],
      },
    ]);
    expect(expectQueryCalls(khataQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, name, phone_number, photo_url, credit_balance_paise, last_visit_at',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'gt', args: ['credit_balance_paise', 0] },
      {
        method: 'order',
        args: ['credit_balance_paise', { ascending: false }],
      },
      { method: 'limit', args: [50] },
    ]);
    expect(expectQueryCalls(lowStockQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, quantity_in_stock, reorder_level, products!inner(id, name, unit, is_active)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'lt', args: ['quantity_in_stock', 10] },
      {
        method: 'order',
        args: ['quantity_in_stock', { ascending: true }],
      },
      { method: 'limit', args: [50] },
    ]);
    expect(expectQueryCalls(negativeStockQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, product_id, quantity_in_stock, products!inner(name, unit, is_stock_tracked)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'lt', args: ['quantity_in_stock', 0] },
      {
        method: 'order',
        args: ['quantity_in_stock', { ascending: true }],
      },
    ]);
    expect(expectQueryCalls(captureInvoicesQuery)).toEqual([
      { method: 'select', args: ['customer_id'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(captureVisitsQuery)).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
    expect(client.rpc.mock.calls).toEqual([
      [
        'get_retention_stats',
        {
          p_shop_id: 'shop-1',
          p_start: '2026-07-01T00:00:00+05:30',
          p_end: '2026-07-15T12:00:00.000Z',
        },
      ],
    ]);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it('degrades retention RPC failures to the exact zero object and warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = queuedClient({});
    client.rpc.mockResolvedValue({
      data: null,
      error: { message: 'retention unavailable' },
    });
    mocks.createClient.mockReturnValue(client);

    const { fetchRetentionStats } = await import('../dashboardQueries');
    await expect(
      fetchRetentionStats('shop-1', {
        start: '2026-01-01T00:00:00+05:30',
        end: '2026-01-31T23:59:59+05:30',
      })
    ).resolves.toEqual({
      messagesSent: 0,
      customersReturned: 0,
      revenueAttributedPaise: 0,
      activeRulesCount: 0,
      perRule: [],
    });
    expect(client.rpc.mock.calls).toEqual([
      [
        'get_retention_stats',
        {
          p_shop_id: 'shop-1',
          p_start: '2026-01-01T00:00:00+05:30',
          p_end: '2026-01-31T23:59:59+05:30',
        },
      ],
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[Dashboard] Retention stats failed:',
      'retention unavailable'
    );
  });

  it('keeps the exported khata limit and error fallback contract', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const khataQuery = createQueryBuilder({
      data: null,
      error: { message: 'khata failed' },
    });
    const client = queuedClient({ customers: [khataQuery] });
    mocks.createClient.mockReturnValue(client);

    const { fetchKhataCustomers } = await import('../dashboardQueries');
    await expect(fetchKhataCustomers('shop-1', 7)).resolves.toEqual([]);
    expect(expectQueryCalls(khataQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, name, phone_number, photo_url, credit_balance_paise, last_visit_at',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'gt', args: ['credit_balance_paise', 0] },
      {
        method: 'order',
        args: ['credit_balance_paise', { ascending: false }],
      },
      { method: 'limit', args: [7] },
    ]);
    expect(error).toHaveBeenCalledWith(
      '[Dashboard] Khata query error:',
      'khata failed'
    );
  });

  it('exports current-month GST rows in invoice/item order with exact formatting', async () => {
    const gstQuery = createQueryBuilder({
      data: [
        {
          id: 'invoice-1',
          invoice_number: 'BG/1',
          created_at: '2026-07-14T20:00:00.000Z',
          total_paise: 11800,
          payment_mode: 'upi',
          customer_gstin: '27ABCDE1234F1Z5',
          customers: { name: 'Asha', phone_number: 'customer-phone' },
          invoice_items: [
            {
              product_name: 'Tyre',
              hsn_code: '4011',
              quantity: 1,
              taxable_amount_paise: 10000,
              cgst_paise: 900,
              sgst_paise: 900,
              igst_paise: 0,
              total_paise: 11800,
            },
            {
              product_name: 'Valve',
              hsn_code: null,
              quantity: 1,
              taxable_amount_paise: 100,
              cgst_paise: 9,
              sgst_paise: 9,
              igst_paise: 0,
              total_paise: 118,
            },
          ],
        },
        {
          id: '1234567890',
          invoice_number: null,
          created_at: '2026-07-01T00:00:00.000Z',
          total_paise: 500,
          payment_mode: null,
          customer_gstin: null,
          customers: null,
          invoice_items: [],
        },
      ],
      error: null,
    });
    const client = queuedClient({ invoices: [gstQuery] });
    mocks.createClient.mockReturnValue(client);

    const { exportGstReport } = await import('../dashboardQueries');
    await expect(exportGstReport('shop-1')).resolves.toEqual([
      {
        'Invoice No': 'BG/1',
        'Invoice Date': '15/07/2026',
        'Customer Name': 'Asha',
        'Customer Phone': 'customer-phone',
        'Buyer GSTIN': '27ABCDE1234F1Z5',
        'HSN/SAC': '4011',
        'Taxable Value (₹)': '100.00',
        'CGST (₹)': '9.00',
        'SGST (₹)': '9.00',
        'IGST (₹)': '0.00',
        'Invoice Total (₹)': '118.00',
        'Payment Mode': 'upi',
      },
      {
        'Invoice No': 'BG/1',
        'Invoice Date': '15/07/2026',
        'Customer Name': 'Asha',
        'Customer Phone': 'customer-phone',
        'Buyer GSTIN': '27ABCDE1234F1Z5',
        'HSN/SAC': '',
        'Taxable Value (₹)': '1.00',
        'CGST (₹)': '0.09',
        'SGST (₹)': '0.09',
        'IGST (₹)': '0.00',
        'Invoice Total (₹)': '1.18',
        'Payment Mode': 'upi',
      },
      {
        'Invoice No': '12345678',
        'Invoice Date': '01/07/2026',
        'Customer Name': 'Walk-in',
        'Customer Phone': '',
        'Buyer GSTIN': '',
        'HSN/SAC': '',
        'Taxable Value (₹)': '5.00',
        'CGST (₹)': '0.00',
        'SGST (₹)': '0.00',
        'IGST (₹)': '0.00',
        'Invoice Total (₹)': '5.00',
        'Payment Mode': 'cash',
      },
    ]);

    expect(expectQueryCalls(gstQuery)).toEqual([
      { method: 'select', args: [GST_SELECT] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-07-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-07-15T23:59:59+05:30'],
      },
      { method: 'order', args: ['created_at', { ascending: true }] },
    ]);
  });

  it('logs and throws the exact GST export query error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const gstQuery = createQueryBuilder({
      data: null,
      error: { message: 'gst failed' },
    });
    const client = queuedClient({ invoices: [gstQuery] });
    mocks.createClient.mockReturnValue(client);

    const { exportGstReport } = await import('../dashboardQueries');
    await expect(exportGstReport('shop-1')).rejects.toThrow(
      'Failed to fetch invoices: gst failed'
    );
    expect(expectQueryCalls(gstQuery)).toEqual([
      { method: 'select', args: [GST_SELECT] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-07-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-07-15T23:59:59+05:30'],
      },
      { method: 'order', args: ['created_at', { ascending: true }] },
    ]);
    expect(error).toHaveBeenCalledWith(
      '[GST Export] Query error:',
      'gst failed'
    );
  });
});
