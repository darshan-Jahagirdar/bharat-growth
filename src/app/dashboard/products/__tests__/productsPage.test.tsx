import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types/database';
import ProductsPage from '../page';

interface QueryRecord {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert';
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  checkUserOnboarded: vi.fn(),
  uploadProductImage: vi.fn(),
  operations: [] as QueryRecord[],
}));

const PRODUCTS: Product[] = [
  {
    id: 'product-1',
    shop_id: 'shop-1',
    name: 'Apollo Actigrip R4 3.00-18',
    sku: 'APL-30018',
    hsn_code: '4011',
    gst_rate_percent: 18,
    unit_price_paise: 180_000,
    selling_price_paise: 210_000,
    unit: 'piece',
    category: 'Tyres',
    tag_id: 'tag-1',
    is_active: true,
    barcode: '1111111111111',
    vertical_attrs: {},
    image_url: null,
    is_stock_tracked: true,
    low_stock_threshold: 5,
    purchase_price_paise: 180_000,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'product-2',
    shop_id: 'shop-1',
    name: 'CEAT Milaze 155/80 R13',
    sku: null,
    hsn_code: '4011',
    gst_rate_percent: 28,
    unit_price_paise: 300_000,
    selling_price_paise: 350_000,
    unit: 'piece',
    category: 'Tyres',
    tag_id: null,
    is_active: false,
    barcode: null,
    vertical_attrs: {},
    image_url: null,
    is_stock_tracked: false,
    low_stock_threshold: 5,
    purchase_price_paise: 300_000,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

function resolveQuery(record: QueryRecord) {
  mocks.operations.push({
    ...record,
    filters: [...record.filters],
  });

  if (record.operation === 'select') {
    if (record.table === 'products') return { data: PRODUCTS, error: null };
    if (record.table === 'inventory') {
      return {
        data: [{ product_id: 'product-1', quantity_in_stock: 7 }],
        error: null,
      };
    }
    if (record.table === 'tags') {
      return { data: [{ id: 'tag-1', name: 'Tyres' }], error: null };
    }
  }

  if (record.operation === 'upsert' && record.table === 'tags') {
    const payload = record.payload as { name: string };
    return { data: { id: 'tag-2', name: payload.name }, error: null };
  }

  if (record.operation === 'insert' && record.table === 'products') {
    return { data: { id: 'product-new' }, error: null };
  }

  return { data: null, error: null };
}

function createQueryBuilder(table: string) {
  const record: QueryRecord = {
    table,
    operation: 'select',
    filters: [],
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      record.filters.push([column, value]);
      return builder;
    }),
    order: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      record.operation = 'insert';
      record.payload = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      record.operation = 'update';
      record.payload = payload;
      return builder;
    }),
    upsert: vi.fn((payload: unknown) => {
      record.operation = 'upsert';
      record.payload = payload;
      return builder;
    }),
    single: vi.fn(() => Promise.resolve(resolveQuery(record))),
    then: (
      onFulfilled: (value: ReturnType<typeof resolveQuery>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(resolveQuery(record)).then(onFulfilled, onRejected),
  };

  return builder;
}

const supabase = {
  auth: { getSession: mocks.getSession },
  from: vi.fn((table: string) => createQueryBuilder(table)),
  storage: {
    from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })),
  },
};

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('@/components/dashboard/BulkUploadModal', () => ({
  default: ({ isOpen, shopId }: { isOpen: boolean; shopId: string }) =>
    isOpen ? <div>Bulk modal {shopId}</div> : null,
}));

vi.mock('@/components/dashboard/AdjustStockModal', () => ({
  default: ({
    isOpen,
    productName,
    currentStock,
  }: {
    isOpen: boolean;
    productName: string;
    currentStock: number | null;
  }) => isOpen ? <div>Stock modal {productName} {currentStock}</div> : null,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/lib/supabase/storage', () => ({
  uploadProductImage: mocks.uploadProductImage,
  extFromUrl: () => 'jpg',
}));

beforeEach(() => {
  mocks.operations.length = 0;
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
  mocks.uploadProductImage.mockResolvedValue({
    publicUrl: 'https://example.com/product.jpg',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Products page behavior contract before decomposition', () => {
  it('loads products, stock, campaign tags, money output, and search filtering', async () => {
    render(<ProductsPage />);

    expect(await screen.findByText(PRODUCTS[0].name)).toBeInTheDocument();
    expect(screen.getByText('2 products total')).toBeInTheDocument();
    expect(screen.getByText('₹2,100.00')).toBeInTheDocument();
    expect(screen.getAllByText('Tyres')).toHaveLength(3);
    expect(screen.getByText('7')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search by name/), {
      target: { value: 'CEAT' },
    });
    expect(screen.queryByText(PRODUCTS[0].name)).not.toBeInTheDocument();
    expect(screen.getByText(PRODUCTS[1].name)).toBeInTheDocument();
  });

  it('validates required fields and preserves the create payload paise conversions', async () => {
    const view = render(<ProductsPage />);
    await screen.findByText(PRODUCTS[0].name);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Product' }));
    const form = view.container.querySelector('form')!;

    fireEvent.submit(form);
    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Apollo Amazer/), {
      target: { value: 'New Test Tyre' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 40111000'), {
      target: { value: '40111000' },
    });
    const priceInputs = form.querySelectorAll<HTMLInputElement>('input[type="number"]');
    fireEvent.change(priceInputs[0], { target: { value: '1234.56' } });
    fireEvent.change(priceInputs[1], { target: { value: '1499.99' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Product added!')).toBeInTheDocument();
    const insert = mocks.operations.find(
      (operation) => operation.table === 'products' && operation.operation === 'insert'
    );
    expect(insert?.payload).toMatchObject({
      shop_id: 'shop-1',
      name: 'New Test Tyre',
      hsn_code: '40111000',
      unit_price_paise: 123_456,
      selling_price_paise: 149_999,
      gst_rate_percent: 18,
      unit: 'piece',
      is_active: true,
      is_stock_tracked: false,
    });
  });

  it('creates and selects an inline Bring-Back campaign tag', async () => {
    const view = render(<ProductsPage />);
    await screen.findByText(PRODUCTS[0].name);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Product' }));
    const form = view.container.querySelector('form')!;
    const tagSelect = form.querySelector<HTMLSelectElement>('select')!;

    fireEvent.change(tagSelect, { target: { value: '__new__' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Tyres, Gift Boxes'), {
      target: { value: 'Seasonal' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mocks.operations).toContainEqual(expect.objectContaining({
        table: 'tags',
        operation: 'upsert',
        payload: { shop_id: 'shop-1', name: 'Seasonal' },
      }));
    });
    expect(tagSelect).toHaveValue('tag-2');
  });

  it('hydrates edit values and preserves the tenant-scoped update payload', async () => {
    const view = render(<ProductsPage />);
    await screen.findByText(PRODUCTS[0].name);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const form = view.container.querySelector('form')!;
    const priceInputs = form.querySelectorAll<HTMLInputElement>('input[type="number"]');

    expect(screen.getByPlaceholderText(/Apollo Amazer/)).toHaveValue(PRODUCTS[0].name);
    expect(priceInputs[0]).toHaveValue(1800);
    expect(priceInputs[1]).toHaveValue(2100);
    fireEvent.change(priceInputs[1], { target: { value: '2499.99' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Update Product' }));

    expect(await screen.findByText('Product updated!')).toBeInTheDocument();
    const update = mocks.operations.find(
      (operation) => operation.table === 'products' && operation.operation === 'update'
    );
    expect(update?.payload).toMatchObject({ selling_price_paise: 249_999 });
    expect(update?.filters).toEqual([
      ['id', 'product-1'],
      ['shop_id', 'shop-1'],
    ]);
  });

  it('opens bulk/stock controls and keeps image type validation client-side', async () => {
    const view = render(<ProductsPage />);
    await screen.findByText(PRODUCTS[0].name);

    fireEvent.click(screen.getByRole('button', { name: /Bulk Upload/ }));
    expect(screen.getByText('Bulk modal shop-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByText(`Stock modal ${PRODUCTS[0].name} 7`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add Product' }));
    const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, {
      target: { files: [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('Only JPG, PNG, or WebP images allowed.')).toBeInTheDocument();
    expect(mocks.uploadProductImage).not.toHaveBeenCalled();
  });
});
