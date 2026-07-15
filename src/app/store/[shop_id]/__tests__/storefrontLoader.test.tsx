import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontLoader } from '../StorefrontLoader';

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface QueryRecord {
  table: string;
  select: string;
  filters: Array<[string, unknown]>;
  orders: Array<[string, unknown]>;
  limit: number | null;
}

const mocks = vi.hoisted(() => ({
  shopResult: { data: null, error: null } as QueryResult,
  ownerResult: { data: null, error: null } as QueryResult,
  productsResult: { data: [], error: null } as QueryResult,
  records: [] as QueryRecord[],
}));

function createQueryBuilder(table: string) {
  const record: QueryRecord = {
    table,
    select: '',
    filters: [],
    orders: [],
    limit: null,
  };

  const builder = {
    select: vi.fn((selection: string) => {
      record.select = selection;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      record.filters.push([column, value]);
      return builder;
    }),
    order: vi.fn((column: string, options: unknown) => {
      record.orders.push([column, options]);
      return builder;
    }),
    limit: vi.fn((value: number) => {
      record.limit = value;
      return builder;
    }),
    single: vi.fn(() => {
      mocks.records.push(record);
      return Promise.resolve(mocks.shopResult);
    }),
    maybeSingle: vi.fn(() => {
      mocks.records.push(record);
      return Promise.resolve(mocks.ownerResult);
    }),
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      mocks.records.push(record);
      return Promise.resolve(mocks.productsResult).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

const supabase = {
  from: vi.fn((table: string) => createQueryBuilder(table)),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/components/storefront/ModernTheme', () => ({
  ModernTheme: ({ shop, products }: { shop: unknown; products: unknown }) => (
    <div data-testid="modern-theme">{JSON.stringify({ shop, products })}</div>
  ),
}));

vi.mock('@/components/storefront/IndustrialTheme', () => ({
  IndustrialTheme: ({ shop, products }: { shop: unknown; products: unknown }) => (
    <div data-testid="industrial-theme">{JSON.stringify({ shop, products })}</div>
  ),
}));

vi.mock('@/components/storefront/FestiveTheme', () => ({
  FestiveTheme: ({ shop, products }: { shop: unknown; products: unknown }) => (
    <div data-testid="festive-theme">{JSON.stringify({ shop, products })}</div>
  ),
}));

const SHOP = {
  id: '11111111-1111-4111-8111-111111111111',
  business_name: 'Ganesh Tyres',
  business_type: 'tyre_shop',
  city: 'Pune',
  state_code: '27',
  logo_url: null,
  theme_preference: 'modern',
  primary_color: '#2563EB',
};

const PRODUCTS = [
  {
    id: 'product-tracked',
    name: 'Tracked Tyre',
    sku: 'TRACKED',
    hsn_code: '4011',
    selling_price_paise: 123_450,
    gst_rate_percent: 18,
    unit: 'piece',
    category: 'Tyres',
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: true,
    inventory: [{ quantity_in_stock: 2.5 }],
  },
  {
    id: 'product-missing-inventory',
    name: 'Missing Inventory',
    sku: null,
    hsn_code: '4011',
    selling_price_paise: 50_000,
    gst_rate_percent: 18,
    unit: 'piece',
    category: null,
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: true,
    inventory: [],
  },
  {
    id: 'product-untracked',
    name: 'Service',
    sku: null,
    hsn_code: '9987',
    selling_price_paise: 10_000,
    gst_rate_percent: 18,
    unit: 'service',
    category: 'Services',
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: false,
    inventory: [{ quantity_in_stock: 99 }],
  },
];

beforeEach(() => {
  mocks.records.length = 0;
  mocks.shopResult = { data: SHOP, error: null };
  mocks.ownerResult = { data: { phone: '+91 98765-43210' }, error: null };
  mocks.productsResult = { data: PRODUCTS, error: null };
  document.title = 'Store | BharatGrowth';
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Storefront loader behavior contract before decomposition', () => {
  it('preserves public query shapes, owner mapping, stock semantics, title, and modern default', async () => {
    render(<StorefrontLoader shopId={SHOP.id} />);

    expect(screen.getByText('Loading storefront...')).toBeInTheDocument();
    const theme = await screen.findByTestId('modern-theme');
    const payload = JSON.parse(theme.textContent ?? '{}');

    expect(payload.shop).toEqual({
      ...SHOP,
      owner_phone: '+91 98765-43210',
    });
    expect(payload.products).toEqual([
      expect.objectContaining({ id: 'product-tracked', stock_quantity: 2.5 }),
      expect.objectContaining({ id: 'product-missing-inventory', stock_quantity: 0 }),
      expect.objectContaining({ id: 'product-untracked', stock_quantity: null }),
    ]);
    expect(document.title).toBe('Ganesh Tyres | BharatGrowth');

    expect(mocks.records).toEqual([
      expect.objectContaining({
        table: 'shops',
        select: 'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color',
        filters: [['id', SHOP.id]],
      }),
      expect.objectContaining({
        table: 'users',
        select: 'phone',
        filters: [['shop_id', SHOP.id], ['role', 'owner'], ['is_active', true]],
        limit: 1,
      }),
      expect.objectContaining({
        table: 'products',
        select: 'id, name, sku, hsn_code, selling_price_paise, gst_rate_percent, unit, category, image_url, vertical_attrs, is_stock_tracked, inventory(quantity_in_stock)',
        filters: [['shop_id', SHOP.id], ['is_active', true]],
        orders: [
          ['category', { ascending: true, nullsFirst: false }],
          ['name', { ascending: true }],
        ],
      }),
    ]);
  });

  it.each([
    ['industrial', 'industrial-theme'],
    ['festive', 'festive-theme'],
    ['modern', 'modern-theme'],
  ])('dispatches the %s theme without changing the mapped catalog', async (themePreference, testId) => {
    mocks.shopResult = {
      data: { ...SHOP, theme_preference: themePreference },
      error: null,
    };

    render(<StorefrontLoader shopId={SHOP.id} />);

    const theme = await screen.findByTestId(testId);
    expect(JSON.parse(theme.textContent ?? '{}').products).toHaveLength(3);
  });

  it('uses modern and the inherited field fallbacks when optional shop fields are absent', async () => {
    mocks.shopResult = {
      data: {
        ...SHOP,
        city: null,
        logo_url: null,
        theme_preference: null,
        primary_color: null,
      },
      error: null,
    };
    mocks.ownerResult = { data: null, error: null };

    render(<StorefrontLoader shopId={SHOP.id} />);

    const theme = await screen.findByTestId('modern-theme');
    expect(JSON.parse(theme.textContent ?? '{}').shop).toMatchObject({
      city: null,
      logo_url: null,
      theme_preference: 'modern',
      primary_color: '#2563EB',
      owner_phone: null,
    });
  });

  it('renders the not-found state only for the current PGRST116 shop response', async () => {
    mocks.shopResult = {
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    };

    render(<StorefrontLoader shopId={SHOP.id} />);

    expect(await screen.findByText('This store does not exist.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('renders fatal shop errors but treats product/contact failures as non-fatal', async () => {
    mocks.shopResult = {
      data: null,
      error: { code: '42501', message: 'permission denied' },
    };

    const first = render(<StorefrontLoader shopId={SHOP.id} />);
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('permission denied')).toBeInTheDocument();
    first.unmount();

    mocks.shopResult = { data: SHOP, error: null };
    mocks.ownerResult = { data: null, error: { message: 'contact unavailable' } };
    mocks.productsResult = { data: null, error: { message: 'catalog unavailable' } };

    render(<StorefrontLoader shopId={SHOP.id} />);
    const theme = await screen.findByTestId('modern-theme');
    expect(JSON.parse(theme.textContent ?? '{}')).toMatchObject({
      shop: { owner_phone: null },
      products: [],
    });
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        '[StorefrontLoader] Products query error:',
        'catalog unavailable'
      );
    });
  });
});
