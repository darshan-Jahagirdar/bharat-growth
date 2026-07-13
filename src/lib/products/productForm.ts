import type {
  GstRatePercent,
  Product,
  ProductUnit,
} from '@/lib/types/database';

export interface ProductForm {
  name: string;
  sku: string;
  hsn_code: string;
  category: string;
  tag_id: string | null;
  unit: ProductUnit;
  unit_price_paise: string;
  selling_price_paise: string;
  gst_rate_percent: GstRatePercent;
  barcode: string;
  is_active: boolean;
  is_stock_tracked: boolean;
}

export interface CampaignTag {
  id: string;
  name: string;
}

export interface StockAdjustmentTarget {
  id: string;
  name: string;
  stock: number | null;
}

export type ProductFieldSetter = <K extends keyof ProductForm>(
  key: K,
  value: ProductForm[K]
) => void;

export const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28];

export const PRODUCT_UNITS: ProductUnit[] = [
  'piece',
  'kg',
  'g',
  'litre',
  'ml',
  'metre',
  'set',
  'pair',
  'box',
];

export const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  sku: '',
  hsn_code: '',
  category: '',
  tag_id: null,
  unit: 'piece',
  unit_price_paise: '',
  selling_price_paise: '',
  gst_rate_percent: 18,
  barcode: '',
  is_active: true,
  is_stock_tracked: false,
};

export const NEW_TAG_SENTINEL = '__new__';

export function rupeesToPaise(rupees: string): number {
  const value = parseFloat(rupees);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function paiseToRupeeString(paise: number): string {
  return (paise / 100).toFixed(2);
}

export function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    sku: product.sku ?? '',
    hsn_code: product.hsn_code,
    category: product.category ?? '',
    tag_id: product.tag_id ?? null,
    unit: product.unit,
    unit_price_paise: paiseToRupeeString(product.unit_price_paise),
    selling_price_paise: paiseToRupeeString(product.selling_price_paise),
    gst_rate_percent: product.gst_rate_percent,
    barcode: product.barcode ?? '',
    is_active: product.is_active,
    is_stock_tracked: product.is_stock_tracked ?? false,
  };
}

export function filterProducts(products: Product[], search: string): Product[] {
  return products.filter((product) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      (product.sku?.toLowerCase().includes(query) ?? false) ||
      product.hsn_code.includes(query) ||
      (product.barcode?.includes(query) ?? false) ||
      (product.category?.toLowerCase().includes(query) ?? false)
    );
  });
}
