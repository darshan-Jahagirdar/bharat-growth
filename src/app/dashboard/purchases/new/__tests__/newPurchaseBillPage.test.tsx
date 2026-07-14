import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/types/database';
import NewPurchaseBillPage from '../page';

interface QueryRecord {
  table: string;
  columns?: string;
  filters: Array<[string, unknown]>;
  orFilter?: string;
  limit?: number;
}

const mocks = vi.hoisted(() => ({
  checkUserOnboarded: vi.fn(),
  getSession: vi.fn(),
  operations: [] as QueryRecord[],
  rpc: vi.fn(),
  savePurchaseOrder: vi.fn(),
}));

const PRODUCTS: Product[] = [
  {
    id: 'product-1',
    shop_id: 'shop-1',
    name: 'Apollo Actigrip R4 3.00-18',
    sku: 'APL-30018',
    hsn_code: '4011',
    gst_rate_percent: 18,
    unit_price_paise: 210_000,
    selling_price_paise: 240_000,
    unit: 'piece',
    category: 'Tyres',
    tag_id: null,
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
    name: 'MRF Zapper',
    sku: 'MRF-ZAPPER',
    hsn_code: '4011',
    gst_rate_percent: 18,
    unit_price_paise: 150_000,
    selling_price_paise: 175_000,
    unit: 'piece',
    category: 'Tyres',
    tag_id: null,
    is_active: true,
    barcode: null,
    vertical_attrs: {},
    image_url: null,
    is_stock_tracked: true,
    low_stock_threshold: 5,
    purchase_price_paise: 125_000,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

function resolveQuery(record: QueryRecord) {
  mocks.operations.push({
    ...record,
    filters: [...record.filters],
  });

  if (record.table === 'shops') {
    return { data: { monthly_ai_scans: 7 }, error: null };
  }
  if (record.table === 'products') {
    return { data: PRODUCTS, error: null };
  }
  return { data: null, error: null };
}

function createQueryBuilder(table: string) {
  const record: QueryRecord = { table, filters: [] };

  const builder = {
    select: vi.fn((columns: string) => {
      record.columns = columns;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      record.filters.push([column, value]);
      return builder;
    }),
    or: vi.fn((filter: string) => {
      record.orFilter = filter;
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn((limit: number) => {
      record.limit = limit;
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
  rpc: mocks.rpc,
};

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/lib/orders/orderQueries', () => ({
  savePurchaseOrder: mocks.savePurchaseOrder,
}));

vi.mock('@/lib/utils/indiaDate', () => ({
  getIndiaDate: () => '2026-07-14',
}));

async function renderPurchasePage() {
  const view = render(<NewPurchaseBillPage />);
  expect(await screen.findByText('7 AI scans left')).toBeInTheDocument();
  return view;
}

async function selectApolloProduct() {
  const productInput = screen.getAllByPlaceholderText('Type product name...')[0];
  fireEvent.change(productInput, { target: { value: 'Apollo' } });
  const suggestion = await screen.findByRole('button', { name: /Apollo Actigrip/ });
  fireEvent.mouseDown(suggestion);
  await waitFor(() => expect(productInput).toHaveValue(PRODUCTS[0].name));
}

beforeEach(() => {
  mocks.operations.length = 0;
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    userId: 'user-1',
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
  mocks.rpc.mockResolvedValue({
    data: { bill_id: 'bill-1', items_processed: 1 },
    error: null,
  });
  mocks.savePurchaseOrder.mockResolvedValue({
    success: true,
    data: { po_number: 'PO/2026-27/00007' },
    error: null,
  });

  let rowId = 0;
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => `row-${++rowId}`),
  });
  vi.stubGlobal('btoa', vi.fn(() => 'encoded-image'));
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('New Purchase Bill behavior contract before decomposition', () => {
  it('resolves the active shop, loads scan quota, and preserves the initial bill state', async () => {
    const view = await renderPurchasePage();

    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.checkUserOnboarded).toHaveBeenCalledWith('user-1');
    expect(screen.getByRole('heading', { name: 'New Purchase Bill' })).toBeInTheDocument();
    expect(view.container.querySelector<HTMLInputElement>('input[type="date"]')).toHaveValue(
      '2026-07-14'
    );
    expect(screen.getByRole('button', { name: 'Save as PO' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Bill (F10)' })).toBeDisabled();
    expect(mocks.operations).toContainEqual(expect.objectContaining({
      table: 'shops',
      columns: 'monthly_ai_scans',
      filters: [['id', 'shop-1']],
    }));
  });

  it('preserves shop-scoped product search and Enter/Tab grid focus navigation', async () => {
    await renderPurchasePage();

    const productInput = screen.getByPlaceholderText('Type product name...');
    fireEvent.change(productInput, { target: { value: 'Apollo' } });
    await screen.findByRole('button', { name: /Apollo Actigrip/ });

    expect(mocks.operations).toContainEqual(expect.objectContaining({
      table: 'products',
      filters: [['shop_id', 'shop-1'], ['is_active', true]],
      orFilter: 'name.ilike.Apollo%,sku.ilike.Apollo%,barcode.eq.Apollo',
      limit: 6,
    }));

    fireEvent.keyDown(productInput, { key: 'Enter' });
    const quantityInput = screen.getAllByRole('spinbutton')[0];
    const priceInput = screen.getAllByRole('spinbutton')[1];
    await waitFor(() => expect(quantityInput).toHaveFocus());
    expect(priceInput).toHaveValue(1800);
    expect(screen.getAllByText('₹1,800.00')).toHaveLength(2);

    fireEvent.keyDown(quantityInput, { key: 'Tab' });
    expect(priceInput).toHaveFocus();
    fireEvent.keyDown(priceInput, { key: 'Enter' });

    await waitFor(() => {
      const productInputs = screen.getAllByPlaceholderText('Type product name...');
      expect(productInputs).toHaveLength(2);
      expect(productInputs[1]).toHaveFocus();
    });
  });

  it('preserves validation, paise totals, the F10 shortcut, and the atomic bill payload', async () => {
    await renderPurchasePage();

    fireEvent.keyDown(window, { key: 'F10' });
    expect(await screen.findByText('Add at least one product to save')).toBeInTheDocument();

    await selectApolloProduct();
    fireEvent.keyDown(window, { key: 'F10' });
    expect(await screen.findByText('Supplier name is required')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. MRF Distributor'), {
      target: { value: '  Metro Distributor  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-0451'), {
      target: { value: '  INV-9  ' },
    });
    const [quantityInput, priceInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '1234.56' } });
    expect(screen.getAllByText('₹2,469.12')).toHaveLength(2);

    fireEvent.keyDown(window, { key: 'F10' });

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('save_purchase_bill', {
        p_bill: {
          shop_id: 'shop-1',
          supplier_name: 'Metro Distributor',
          bill_number: 'INV-9',
          bill_date: '2026-07-14',
          total_amount_paise: 246_912,
          created_by: 'user-1',
        },
        p_items: [{
          product_id: 'product-1',
          quantity: 2,
          unit_price_paise: 123_456,
        }],
      });
    });
    expect(screen.getByText('Bill saved! 1 item stocked in (₹2,469.12)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. MRF Distributor')).toHaveValue('');
    expect(screen.getByPlaceholderText('Type product name...')).toHaveValue('');
  });

  it('preserves the draft purchase-order payload without invoking the stock RPC', async () => {
    await renderPurchasePage();
    await selectApolloProduct();

    fireEvent.change(screen.getByPlaceholderText('e.g. MRF Distributor'), {
      target: { value: '  Metro Distributor  ' },
    });
    const [quantityInput, priceInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(quantityInput, { target: { value: '3' } });
    fireEvent.change(priceInput, { target: { value: '1000.05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as PO' }));

    await waitFor(() => {
      expect(mocks.savePurchaseOrder).toHaveBeenCalledWith({
        shopId: 'shop-1',
        supplierName: 'Metro Distributor',
        expectedDate: '2026-07-14',
        totalAmountPaise: 300_015,
        createdBy: 'user-1',
        items: [{
          productId: 'product-1',
          quantity: 3,
          expectedPricePaise: 100_005,
        }],
      });
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(screen.getByText(
      'Purchase Order PO/2026-27/00007 created! No stock changes until received.'
    )).toBeInTheDocument();
  });

  it('validates scan files and preserves single-query exact, leading-word, and unmatched mapping', async () => {
    await renderPurchasePage();
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    const invalidFile = new File(['not-an-image'], 'bill.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(await screen.findByText('Choose a JPEG, PNG, WebP, or GIF image.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    const imageFile = new File(['image'], 'bill.png', { type: 'image/png' });
    Object.defineProperty(imageFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer),
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        scans_remaining: 6,
        items: [
          { raw_name: 'Apollo Actigrip R4 3.00-18', quantity: 2, price_paise: 170_000 },
          { raw_name: 'MRF Zapper 100', quantity: 1, price_paise: 120_000 },
          { raw_name: 'CEAT Unknown', quantity: 4, price_paise: 90_000 },
        ],
      }),
    } as unknown as Response);

    fireEvent.change(fileInput, { target: { files: [imageFile] } });

    expect(await screen.findByText('6 AI scans left')).toBeInTheDocument();
    expect(screen.getByText(
      '2/3 products matched. 1 unmatched — select them manually before saving.'
    )).toBeInTheDocument();
    expect(screen.getByText('UNMATCHED')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Type product name...').map((input) => (
      input as HTMLInputElement
    ).value))
      .toEqual([
        'Apollo Actigrip R4 3.00-18',
        'MRF Zapper 100',
        'CEAT Unknown',
        '',
      ]);
    expect(fetch).toHaveBeenCalledWith('/api/vision/scan-bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: 'encoded-image',
        image_mime_type: 'image/png',
      }),
    });
    const productQueries = mocks.operations.filter(({ table }) => table === 'products');
    expect(productQueries).toHaveLength(1);
    expect(productQueries[0]).toEqual(expect.objectContaining({
      table: 'products',
      columns: '*',
      filters: [['shop_id', 'shop-1'], ['is_active', true]],
    }));
    expect(productQueries[0]).not.toHaveProperty('orFilter');
  });
});
