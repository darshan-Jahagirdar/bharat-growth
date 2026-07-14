import type { CreatePOParams } from '@/lib/orders/orderQueries';
import type { Product } from '@/lib/types/database';

export interface GridRow {
  id: string;
  productQuery: string;
  product: Product | null;
  quantity: number;
  costPricePaise: number;
  matched: boolean;
  suggestions: Product[];
  showSuggestions: boolean;
}

export interface ScannedPurchaseItem {
  raw_name: string;
  quantity: number;
  price_paise: number;
}

export interface PurchaseBillRpcArgs {
  p_bill: {
    shop_id: string;
    supplier_name: string;
    bill_number: string | null;
    bill_date: string;
    total_amount_paise: number;
    created_by: string | null;
  };
  p_items: Array<{
    product_id: string;
    quantity: number;
    unit_price_paise: number;
  }>;
}

export function createEmptyRow(id = crypto.randomUUID()): GridRow {
  return {
    id,
    productQuery: '',
    product: null,
    quantity: 1,
    costPricePaise: 0,
    matched: false,
    suggestions: [],
    showSuggestions: false,
  };
}

export function findBestProductMatch(rawName: string, products: Product[]): Product | null {
  const trimmed = rawName.trim().toLowerCase();
  if (!trimmed) return null;

  let bestProduct: Product | null = null;
  let bestScore = 0;

  for (const product of products) {
    const productName = product.name.toLowerCase();
    if (productName === trimmed) return product;

    const rawWords = trimmed.split(/\s+/);
    const productWords = productName.split(/\s+/);
    let matchCount = 0;

    for (let index = 0; index < Math.min(rawWords.length, productWords.length); index++) {
      if (rawWords[index] === productWords[index]) matchCount++;
      else break;
    }

    if (matchCount === rawWords.length && matchCount === productWords.length) {
      return product;
    }

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestProduct = product;
    }
  }

  return bestScore >= 2 ? bestProduct : null;
}

export function mapScannedItemsToRows(
  items: ScannedPurchaseItem[],
  products: Product[],
  createId: () => string = () => crypto.randomUUID()
): { rows: GridRow[]; matchedCount: number } {
  let matchedCount = 0;
  const rows = items.map((item) => {
    const product = findBestProductMatch(item.raw_name, products);
    if (product) matchedCount++;

    return {
      id: createId(),
      productQuery: item.raw_name,
      product,
      quantity: item.quantity,
      costPricePaise: item.price_paise,
      matched: product !== null,
      suggestions: [],
      showSuggestions: false,
    };
  });

  return { rows, matchedCount };
}

export function mergeScannedRows(existingRows: GridRow[], scannedRows: GridRow[]): GridRow[] {
  const existingWithData = existingRows.filter((row) => row.product !== null);
  return [...existingWithData, ...scannedRows, createEmptyRow()];
}

export function getSelectedRows(rows: GridRow[]): GridRow[] {
  return rows.filter((row) => row.product !== null);
}

export function getSaveableRows(rows: GridRow[]): Array<GridRow & { product: Product }> {
  return rows.filter(
    (row): row is GridRow & { product: Product } => row.product !== null && row.quantity > 0
  );
}

export function calculateRowsTotal(rows: GridRow[]): number {
  return rows.reduce((sum, row) => sum + row.costPricePaise * row.quantity, 0);
}

export function calculateGrandTotal(rows: GridRow[]): number {
  return rows.reduce(
    (sum, row) => sum + (row.product ? row.costPricePaise * row.quantity : 0),
    0
  );
}

export function countSkippedRows(rows: GridRow[], validRowCount: number): number {
  return rows.filter((row) => row.productQuery.trim()).length - validRowCount;
}

export function getScanMatchMessage(matchedCount: number, totalCount: number): string {
  const unmatchedCount = totalCount - matchedCount;
  return unmatchedCount > 0
    ? `${matchedCount}/${totalCount} products matched. ${unmatchedCount} unmatched — select them manually before saving.`
    : '';
}

export function getScanFileError(file: Pick<File, 'type' | 'size'>): string | null {
  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!supportedTypes.has(file.type)) {
    return 'Choose a JPEG, PNG, WebP, or GIF image.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image is too large. Maximum size is 5 MB.';
  }
  return null;
}

export function buildPurchaseBillRpcArgs(params: {
  shopId: string;
  supplierName: string;
  billNumber: string;
  billDate: string;
  createdBy: string | null;
  rows: Array<GridRow & { product: Product }>;
}): PurchaseBillRpcArgs {
  return {
    p_bill: {
      shop_id: params.shopId,
      supplier_name: params.supplierName.trim(),
      bill_number: params.billNumber.trim() || null,
      bill_date: params.billDate,
      total_amount_paise: calculateRowsTotal(params.rows),
      created_by: params.createdBy,
    },
    p_items: params.rows.map((row) => ({
      product_id: row.product.id,
      quantity: row.quantity,
      unit_price_paise: row.costPricePaise,
    })),
  };
}

export function buildPurchaseOrderParams(params: {
  shopId: string;
  supplierName: string;
  billDate: string;
  createdBy?: string;
  rows: Array<GridRow & { product: Product }>;
}): CreatePOParams {
  return {
    shopId: params.shopId,
    supplierName: params.supplierName.trim(),
    expectedDate: params.billDate,
    totalAmountPaise: calculateRowsTotal(params.rows),
    createdBy: params.createdBy,
    items: params.rows.map((row) => ({
      productId: row.product.id,
      quantity: row.quantity,
      expectedPricePaise: row.costPricePaise,
    })),
  };
}
