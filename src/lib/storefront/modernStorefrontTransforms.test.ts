import { describe, expect, it } from 'vitest';
import type { StorefrontProduct, StorefrontShop } from '@/lib/storefront/queries';
import {
  addStorefrontCartItem,
  buildStorefrontCheckoutPayload,
  buildStorefrontWhatsAppLink,
  filterStorefrontProducts,
  formatStorefrontPrice,
  getStorefrontCartItems,
  getStorefrontCartQuantity,
  getStorefrontCategories,
  getStorefrontPlaceholderColor,
  getStorefrontStockMessage,
  removeStorefrontCartItem,
  summarizeStorefrontCart,
  type StorefrontCart,
} from './modernStorefrontTransforms';

function product(overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    id: 'product-a',
    name: 'A',
    sku: null,
    hsn_code: '4011',
    selling_price_paise: 5_000,
    gst_rate_percent: 18,
    unit: 'piece',
    category: 'Tyres',
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: true,
    stock_quantity: 2,
    ...overrides,
  };
}

const SHOP: StorefrontShop = {
  id: 'shop-a',
  business_name: 'Ganesh Tyres',
  business_type: 'tyre_shop',
  city: 'Pune',
  state_code: '27',
  logo_url: null,
  theme_preference: 'modern',
  primary_color: '#2563EB',
  owner_phone: '+91 98765-43210',
};

describe('modern Storefront pure transforms', () => {
  it('preserves integer-rupee formatting and deterministic placeholder colors', () => {
    expect(formatStorefrontPrice(12_345)).toBe('₹123');
    expect(formatStorefrontPrice(5_000)).toBe('₹50');
    expect(getStorefrontPlaceholderColor('A')).toBe('#F59E0B');
    expect(getStorefrontPlaceholderColor('')).toBe('#F97316');
    expect(getStorefrontPlaceholderColor('Sweet Box')).toBe(
      getStorefrontPlaceholderColor('Sweet Box')
    );
  });

  it('preserves sorted unique categories and exact category/search semantics', () => {
    const products = [
      product({ id: 'a', name: 'All Season', category: 'Tyres' }),
      product({ id: 'b', name: 'Sweet Box', category: 'Sweets' }),
      product({ id: 'c', name: 'Unsorted', category: null }),
      product({ id: 'd', name: 'Tyre Polish', category: 'Tyres' }),
    ];

    expect(getStorefrontCategories(products)).toEqual(['All', 'Sweets', 'Tyres']);
    expect(filterStorefrontProducts(products, 'Sweets', '')).toEqual([products[1]]);
    expect(filterStorefrontProducts(products, 'All', 'sweet')).toEqual([products[1]]);
    expect(filterStorefrontProducts(products, 'All', 'TYRES')).toEqual([
      products[0],
      products[3],
    ]);
    expect(filterStorefrontProducts(products, 'Tyres', 'polish')).toEqual([products[3]]);
    expect(filterStorefrontProducts(products, 'All', '   ')).toEqual(products);
    expect(filterStorefrontProducts(products, 'All', ' tyres ')).toEqual([]);
  });

  it('preserves Map order, stock clamps, quantities, totals, decrements, and removal identity', () => {
    const tracked = product();
    const untracked = product({
      id: 'product-b',
      name: 'B',
      selling_price_paise: 12_345,
      is_stock_tracked: false,
      stock_quantity: null,
    });
    const empty: StorefrontCart = new Map();

    expect(getStorefrontCartQuantity(empty, tracked.id)).toBe(0);
    expect(removeStorefrontCartItem(empty, 'missing')).toBe(empty);

    expect(getStorefrontStockMessage(empty, tracked)).toBeNull();
    const first = addStorefrontCartItem(empty, tracked);
    expect(first).not.toBe(empty);
    expect(getStorefrontCartQuantity(first, tracked.id)).toBe(1);

    const second = addStorefrontCartItem(first, tracked);
    const withUntracked = addStorefrontCartItem(second, untracked);
    expect(getStorefrontCartItems(withUntracked).map((item) => item.product.id)).toEqual([
      tracked.id,
      untracked.id,
    ]);
    expect(summarizeStorefrontCart(getStorefrontCartItems(withUntracked))).toEqual({
      count: 3,
      totalPaise: 22_345,
    });

    expect(getStorefrontStockMessage(withUntracked, tracked)).toBe(
      'Only 2 available in stock'
    );

    const decremented = removeStorefrontCartItem(withUntracked, tracked.id);
    expect(getStorefrontCartQuantity(decremented, tracked.id)).toBe(1);
    const removed = removeStorefrontCartItem(decremented, tracked.id);
    expect(getStorefrontCartQuantity(removed, tracked.id)).toBe(0);
    expect(getStorefrontCartItems(removed).map((item) => item.product.id)).toEqual([
      untracked.id,
    ]);
  });

  it('preserves trimmed checkout payload fields, null address, item order, and consent values', () => {
    const cartItems = [
      { product: product(), qty: 2 },
      { product: product({ id: 'product-b', name: 'B' }), qty: 1 },
    ];

    expect(buildStorefrontCheckoutPayload({
      shopId: SHOP.id,
      checkoutName: '  Buyer  ',
      checkoutPhone: '  9876543210  ',
      checkoutAddress: '   ',
      paymentMethod: 'khata',
      dataConsent: true,
      marketingConsent: false,
      idempotencyKey: 'attempt-a',
      cartItems,
    })).toEqual({
      shop_id: SHOP.id,
      customer_name: 'Buyer',
      customer_phone: '9876543210',
      delivery_address: null,
      payment_method: 'khata',
      data_consent: true,
      marketing_consent: false,
      idempotency_key: 'attempt-a',
      items: [
        { product_id: 'product-a', quantity: 2 },
        { product_id: 'product-b', quantity: 1 },
      ],
    });
  });

  it('preserves phone cleanup, raw customer fields, item order, payment copy, and confirmed totals in WhatsApp links', () => {
    const link = buildStorefrontWhatsAppLink({
      shop: SHOP,
      checkoutName: '  Buyer  ',
      checkoutPhone: '9876543210',
      checkoutAddress: '  MG Road  ',
      paymentMethod: 'khata',
      cartItems: [
        { product: product(), qty: 1 },
        { product: product({ id: 'product-b', name: 'B', selling_price_paise: 12_345 }), qty: 1 },
      ],
      cartTotal: 17_345,
      order: {
        invoice_number: 'ON/2026-27/00009',
        total_paise: 6_000,
      },
    });

    expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe([
      '*New Order from Ganesh Tyres Store*',
      '',
      '*Order No:* ON/2026-27/00009',
      '*Customer:*   Buyer  ',
      '*Phone:* 9876543210',
      '*Address:*   MG Road  ',
      '*Payment:* Khata (Pay Later)',
      '',
      '*Order Items:*',
      '1x A — ₹50',
      '1x B — ₹123',
      '',
      '*Total: ₹60*',
    ].join('\n'));
  });

  it('preserves guest and UPI fallbacks when optional checkout message fields are absent', () => {
    const link = buildStorefrontWhatsAppLink({
      shop: { ...SHOP, owner_phone: '9199' },
      checkoutName: '',
      checkoutPhone: '',
      checkoutAddress: '',
      paymentMethod: 'upi',
      cartItems: [],
      cartTotal: 0,
    });

    expect(link.startsWith('https://wa.me/9199?text=')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe([
      '*New Order from Ganesh Tyres Store*',
      '',
      '*Customer:* Guest',
      '*Payment:* UPI',
      '',
      '*Order Items:*',
      '',
      '*Total: ₹0*',
    ].join('\n'));
  });
});
