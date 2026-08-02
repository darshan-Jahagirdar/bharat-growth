import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryBuilder, expectQueryCalls } from '@/test/supabaseQueryMock';

const mocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: mocks.createPublicClient,
}));

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(),
    rpc: vi.fn(),
    ...overrides,
  };
}

describe('storefront queries characterization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mocks.createPublicClient.mockReset();
  });

  it('uses the public client, exact safe shop projection, and owner-phone RPC', async () => {
    const shopQuery = createQueryBuilder({
      data: {
        id: 'shop-1',
        business_name: 'Ganesh Tyres',
        business_type: 'tyre_shop',
        city: undefined,
        state_code: '27',
        logo_url: undefined,
        theme_preference: null,
        primary_color: null,
      },
      error: null,
    });
    const client = mockClient({
      from: vi.fn().mockReturnValue(shopQuery),
      rpc: vi.fn().mockResolvedValue({
        data: 'customer-phone',
        error: null,
      }),
    });
    mocks.createPublicClient.mockReturnValue(client);

    const { getStorefrontShop } = await import('../queries');
    await expect(getStorefrontShop('shop-1')).resolves.toEqual({
      id: 'shop-1',
      business_name: 'Ganesh Tyres',
      business_type: 'tyre_shop',
      city: null,
      state_code: '27',
      logo_url: null,
      theme_preference: 'modern',
      primary_color: '#2563EB',
      owner_phone: 'customer-phone',
    });

    expect(mocks.createPublicClient).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('shops');
    expect(expectQueryCalls(shopQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color',
        ],
      },
      { method: 'eq', args: ['id', 'shop-1'] },
      { method: 'single', args: [] },
    ]);
    expect(client.rpc.mock.calls).toEqual([
      ['get_storefront_owner_phone', { p_shop_id: 'shop-1' }],
    ]);
  });

  it('keeps owner-phone failure non-fatal and rejects non-string RPC data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shopQuery = createQueryBuilder({
      data: {
        id: 'shop-1',
        business_name: 'Ganesh Tyres',
        business_type: 'general_store',
        city: 'Pune',
        state_code: '27',
        logo_url: null,
        theme_preference: 'festive',
        primary_color: '#111111',
      },
      error: null,
    });
    const client = mockClient({
      from: vi.fn().mockReturnValue(shopQuery),
      rpc: vi.fn().mockResolvedValue({
        data: { phone: 'not accepted' },
        error: { message: 'owner hidden' },
      }),
    });
    mocks.createPublicClient.mockReturnValue(client);

    const { getStorefrontShop } = await import('../queries');
    const result = await getStorefrontShop('shop-1');
    expect(result?.owner_phone).toBeNull();
    expect(client.from).toHaveBeenCalledWith('shops');
    expect(expectQueryCalls(shopQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color',
        ],
      },
      { method: 'eq', args: ['id', 'shop-1'] },
      { method: 'single', args: [] },
    ]);
    expect(client.rpc.mock.calls).toEqual([
      ['get_storefront_owner_phone', { p_shop_id: 'shop-1' }],
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[Storefront] Owner phone query failed (non-fatal):',
      'owner hidden'
    );
  });

  it('stops after a shop error and preserves its error side effect', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const shopQuery = createQueryBuilder({
      data: null,
      error: { message: 'shop missing', code: 'PGRST116' },
    });
    const client = mockClient({
      from: vi.fn().mockReturnValue(shopQuery),
      rpc: vi.fn(),
    });
    mocks.createPublicClient.mockReturnValue(client);

    const { getStorefrontShop } = await import('../queries');
    await expect(getStorefrontShop('shop-1')).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledWith('shops');
    expect(expectQueryCalls(shopQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color',
        ],
      },
      { method: 'eq', args: ['id', 'shop-1'] },
      { method: 'single', args: [] },
    ]);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      '[Storefront] Shop query error:',
      'shop missing',
      'PGRST116'
    );
  });

  it('orders the active public catalog and maps tracked, untracked, and missing inventory', async () => {
    const productQuery = createQueryBuilder({
      data: [
        {
          id: 'product-1',
          name: 'Tracked Array',
          sku: 'SKU-1',
          hsn_code: '4011',
          selling_price_paise: 10000,
          gst_rate_percent: 18,
          unit: 'pcs',
          category: 'Tyres',
          image_url: null,
          vertical_attrs: { width: '195' },
          is_stock_tracked: true,
          inventory: [{ quantity_in_stock: '3' }],
        },
        {
          id: 'product-2',
          name: 'Tracked Object',
          sku: null,
          hsn_code: '4011',
          selling_price_paise: 5000,
          gst_rate_percent: 12,
          unit: 'pcs',
          category: null,
          image_url: null,
          vertical_attrs: {},
          is_stock_tracked: true,
          inventory: { quantity_in_stock: 7 },
        },
        {
          id: 'product-3',
          name: 'Untracked',
          sku: null,
          hsn_code: '4011',
          selling_price_paise: 1000,
          gst_rate_percent: 5,
          unit: 'pcs',
          category: null,
          image_url: null,
          vertical_attrs: {},
          is_stock_tracked: null,
          inventory: { quantity_in_stock: 99 },
        },
        {
          id: 'product-4',
          name: 'Tracked Missing',
          sku: null,
          hsn_code: '4011',
          selling_price_paise: 1000,
          gst_rate_percent: 5,
          unit: 'pcs',
          category: null,
          image_url: null,
          vertical_attrs: {},
          is_stock_tracked: true,
          inventory: null,
        },
      ],
      error: null,
    });
    const client = mockClient({ from: vi.fn().mockReturnValue(productQuery) });
    mocks.createPublicClient.mockReturnValue(client);

    const { getStorefrontProducts } = await import('../queries');
    const result = await getStorefrontProducts('shop-1');

    expect(result.map(({ id, is_stock_tracked, stock_quantity }) => ({
      id,
      is_stock_tracked,
      stock_quantity,
    }))).toEqual([
      { id: 'product-1', is_stock_tracked: true, stock_quantity: 3 },
      { id: 'product-2', is_stock_tracked: true, stock_quantity: 7 },
      { id: 'product-3', is_stock_tracked: false, stock_quantity: null },
      { id: 'product-4', is_stock_tracked: true, stock_quantity: null },
    ]);
    expect(client.from).toHaveBeenCalledWith('products');
    expect(expectQueryCalls(productQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, name, sku, hsn_code, selling_price_paise, gst_rate_percent, unit, category, image_url, vertical_attrs, is_stock_tracked, inventory(quantity_in_stock)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['is_active', true] },
      {
        method: 'order',
        args: ['category', { ascending: true, nullsFirst: false }],
      },
      { method: 'order', args: ['name', { ascending: true }] },
    ]);
  });

  it('returns an empty catalog and logs exact product query errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const productQuery = createQueryBuilder({
      data: null,
      error: { message: 'catalog failed', code: '42501' },
    });
    const client = mockClient({ from: vi.fn().mockReturnValue(productQuery) });
    mocks.createPublicClient.mockReturnValue(client);

    const { getStorefrontProducts } = await import('../queries');
    await expect(getStorefrontProducts('shop-1')).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledWith('products');
    expect(expectQueryCalls(productQuery)).toEqual([
      {
        method: 'select',
        args: [
          'id, name, sku, hsn_code, selling_price_paise, gst_rate_percent, unit, category, image_url, vertical_attrs, is_stock_tracked, inventory(quantity_in_stock)',
        ],
      },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['is_active', true] },
      {
        method: 'order',
        args: ['category', { ascending: true, nullsFirst: false }],
      },
      { method: 'order', args: ['name', { ascending: true }] },
    ]);
    expect(error).toHaveBeenCalledWith(
      '[Storefront] Products query error:',
      'catalog failed',
      '42501'
    );
  });
});
