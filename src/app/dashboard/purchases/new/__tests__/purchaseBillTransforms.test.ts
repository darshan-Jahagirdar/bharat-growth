import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/types/database';
import {
  buildPurchaseBillRpcArgs,
  buildPurchaseOrderParams,
  calculateGrandTotal,
  countSkippedRows,
  createEmptyRow,
  findBestProductMatch,
  getSaveableRows,
  getScanFileError,
  getScanMatchMessage,
  getSelectedRows,
  mapScannedItemsToRows,
  mergeScannedRows,
  type GridRow,
} from '../purchaseBillTransforms';

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
    barcode: null,
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

function row(overrides: Partial<GridRow> = {}): GridRow {
  return {
    ...createEmptyRow('row-1'),
    ...overrides,
  };
}

describe('purchase bill pure transforms', () => {
  it('creates the exact empty speed-grid row shape', () => {
    expect(createEmptyRow('row-7')).toEqual({
      id: 'row-7',
      productQuery: '',
      product: null,
      quantity: 1,
      costPricePaise: 0,
      matched: false,
      suggestions: [],
      showSuggestions: false,
    });
  });

  it('preserves exact and two-leading-word matching without one-word false positives', () => {
    expect(findBestProductMatch(' apollo actigrip r4 3.00-18 ', PRODUCTS)).toBe(PRODUCTS[0]);
    expect(findBestProductMatch('MRF Zapper 100', PRODUCTS)).toBe(PRODUCTS[1]);
    expect(findBestProductMatch('Apollo Unknown', PRODUCTS)).toBeNull();
    expect(findBestProductMatch('   ', PRODUCTS)).toBeNull();
  });

  it('maps scanned items once and preserves matched, unmatched, and row merge behavior', () => {
    let nextId = 0;
    const mapped = mapScannedItemsToRows([
      { raw_name: PRODUCTS[0].name, quantity: 2, price_paise: 170_000 },
      { raw_name: 'CEAT Unknown', quantity: 4, price_paise: 90_000 },
    ], PRODUCTS, () => `scan-${++nextId}`);

    expect(mapped.matchedCount).toBe(1);
    expect(mapped.rows).toEqual([
      row({
        id: 'scan-1',
        productQuery: PRODUCTS[0].name,
        product: PRODUCTS[0],
        quantity: 2,
        costPricePaise: 170_000,
        matched: true,
      }),
      row({
        id: 'scan-2',
        productQuery: 'CEAT Unknown',
        quantity: 4,
        costPricePaise: 90_000,
      }),
    ]);

    const existingProductRow = row({ product: PRODUCTS[1], matched: true });
    const emptyExistingRow = createEmptyRow('discard-me');
    expect(mergeScannedRows([existingProductRow, emptyExistingRow], mapped.rows).slice(0, -1))
      .toEqual([existingProductRow, ...mapped.rows]);
  });

  it('preserves selected/saveable row distinctions, paise totals, and skipped count', () => {
    const rows = [
      row({ productQuery: PRODUCTS[0].name, product: PRODUCTS[0], quantity: 2, costPricePaise: 123_456 }),
      row({ id: 'row-2', productQuery: PRODUCTS[1].name, product: PRODUCTS[1], quantity: 0, costPricePaise: 50_000 }),
      row({ id: 'row-3', productQuery: 'CEAT Unknown', quantity: 4, costPricePaise: 90_000 }),
    ];

    expect(getSelectedRows(rows)).toHaveLength(2);
    const saveableRows = getSaveableRows(rows);
    expect(saveableRows).toHaveLength(1);
    expect(calculateGrandTotal(rows)).toBe(246_912);
    expect(countSkippedRows(rows, saveableRows.length)).toBe(2);
  });

  it('preserves exact atomic bill and draft purchase-order payloads', () => {
    const rows = getSaveableRows([
      row({ product: PRODUCTS[0], quantity: 2, costPricePaise: 123_456 }),
    ]);

    expect(buildPurchaseBillRpcArgs({
      shopId: 'shop-1',
      supplierName: '  Metro Distributor  ',
      billNumber: '  INV-9  ',
      billDate: '2026-07-14',
      createdBy: 'user-1',
      rows,
    })).toEqual({
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

    expect(buildPurchaseOrderParams({
      shopId: 'shop-1',
      supplierName: '  Metro Distributor  ',
      billDate: '2026-07-14',
      createdBy: 'user-1',
      rows,
    })).toEqual({
      shopId: 'shop-1',
      supplierName: 'Metro Distributor',
      expectedDate: '2026-07-14',
      totalAmountPaise: 246_912,
      createdBy: 'user-1',
      items: [{
        productId: 'product-1',
        quantity: 2,
        expectedPricePaise: 123_456,
      }],
    });
  });

  it('preserves scan validation and unmatched feedback copy', () => {
    expect(getScanFileError({ type: 'application/pdf', size: 100 })).toBe(
      'Choose a JPEG, PNG, WebP, or GIF image.'
    );
    expect(getScanFileError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe(
      'Image is too large. Maximum size is 5 MB.'
    );
    expect(getScanFileError({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull();
    expect(getScanMatchMessage(2, 3)).toBe(
      '2/3 products matched. 1 unmatched — select them manually before saving.'
    );
    expect(getScanMatchMessage(3, 3)).toBe('');
  });
});
