import { describe, expect, it } from 'vitest';
import type { Product } from '@/lib/types/database';
import {
  filterProducts,
  paiseToRupeeString,
  productToForm,
  rupeesToPaise,
} from '../productForm';

const PRODUCT: Product = {
  id: 'product-1',
  shop_id: 'shop-1',
  name: 'Apollo Actigrip R4',
  sku: 'APL-R4',
  hsn_code: '4011',
  gst_rate_percent: 18,
  unit_price_paise: 123_456,
  selling_price_paise: 149_999,
  unit: 'piece',
  category: 'Tyres',
  tag_id: 'tag-1',
  is_active: true,
  barcode: '1111111111111',
  vertical_attrs: {},
  image_url: null,
  is_stock_tracked: true,
  low_stock_threshold: 5,
  purchase_price_paise: 123_456,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('product form helpers', () => {
  it('preserves the existing rupee and integer-paise rounding rules', () => {
    expect(rupeesToPaise('1234.56')).toBe(123_456);
    expect(rupeesToPaise('1499.999')).toBe(150_000);
    expect(rupeesToPaise('invalid')).toBe(0);
    expect(paiseToRupeeString(149_999)).toBe('1499.99');
  });

  it('hydrates editable rupee strings and nullable product fields', () => {
    expect(productToForm(PRODUCT)).toEqual({
      name: 'Apollo Actigrip R4',
      sku: 'APL-R4',
      hsn_code: '4011',
      category: 'Tyres',
      tag_id: 'tag-1',
      unit: 'piece',
      unit_price_paise: '1234.56',
      selling_price_paise: '1499.99',
      gst_rate_percent: 18,
      barcode: '1111111111111',
      is_active: true,
      is_stock_tracked: true,
    });
  });

  it.each(['apollo', 'APL-R4', '4011', '1111111111111', 'tyres'])(
    'keeps the existing search match for %s',
    (search) => {
      expect(filterProducts([PRODUCT], search)).toEqual([PRODUCT]);
    }
  );

  it('returns every product for an empty search and none for an unrelated search', () => {
    expect(filterProducts([PRODUCT], '')).toEqual([PRODUCT]);
    expect(filterProducts([PRODUCT], 'brake pad')).toEqual([]);
  });
});
