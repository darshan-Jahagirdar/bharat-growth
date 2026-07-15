import type { StorefrontProduct, StorefrontShop } from '@/lib/storefront/queries';

export interface StorefrontCartItem {
  product: StorefrontProduct;
  qty: number;
}

export type StorefrontCart = Map<string, StorefrontCartItem>;
export type StorefrontPaymentMethod = 'upi' | 'khata';

export interface StorefrontCheckoutResult {
  order_id: string;
  invoice_number: string;
  total_paise: number;
}

export interface StorefrontCheckoutPayload {
  shop_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  payment_method: StorefrontPaymentMethod;
  data_consent: boolean;
  marketing_consent: boolean;
  idempotency_key: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

const PLACEHOLDER_COLORS = [
  '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#F59E0B', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6',
];

export function formatStorefrontPrice(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function getStorefrontPlaceholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

export function getStorefrontCategories(products: StorefrontProduct[]): string[] {
  const categories = new Set<string>();
  for (const product of products) {
    if (product.category) categories.add(product.category);
  }
  return ['All', ...Array.from(categories).sort()];
}

export function filterStorefrontProducts(
  products: StorefrontProduct[],
  activeCategory: string,
  searchQuery: string
): StorefrontProduct[] {
  return products.filter((product) => {
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const query = searchQuery.toLowerCase();
    return matchesCategory && (
      product.name.toLowerCase().includes(query) ||
      (product.category?.toLowerCase().includes(query) ?? false)
    );
  });
}

export function getStorefrontCartItems(cart: StorefrontCart): StorefrontCartItem[] {
  return Array.from(cart.values());
}

export function summarizeStorefrontCart(cartItems: StorefrontCartItem[]): {
  count: number;
  totalPaise: number;
} {
  return cartItems.reduce(
    (summary, cartItem) => ({
      count: summary.count + cartItem.qty,
      totalPaise: summary.totalPaise + cartItem.product.selling_price_paise * cartItem.qty,
    }),
    { count: 0, totalPaise: 0 }
  );
}

export function getStorefrontStockMessage(
  cart: StorefrontCart,
  product: StorefrontProduct
): string | null {
  const currentQty = cart.get(product.id)?.qty ?? 0;
  if (
    product.is_stock_tracked &&
    product.stock_quantity !== null &&
    currentQty + 1 > product.stock_quantity
  ) {
    return `Only ${product.stock_quantity} available in stock`;
  }
  return null;
}

export function addStorefrontCartItem(
  cart: StorefrontCart,
  product: StorefrontProduct
): StorefrontCart {
  const next = new Map(cart);
  const existing = next.get(product.id);
  if (existing) {
    next.set(product.id, { ...existing, qty: existing.qty + 1 });
  } else {
    next.set(product.id, { product, qty: 1 });
  }

  return next;
}

export function removeStorefrontCartItem(
  cart: StorefrontCart,
  productId: string
): StorefrontCart {
  const existing = cart.get(productId);
  if (!existing) return cart;

  const next = new Map(cart);
  if (existing.qty <= 1) {
    next.delete(productId);
  } else {
    next.set(productId, { ...existing, qty: existing.qty - 1 });
  }
  return next;
}

export function getStorefrontCartQuantity(cart: StorefrontCart, productId: string): number {
  return cart.get(productId)?.qty ?? 0;
}

export function buildStorefrontCheckoutPayload({
  shopId,
  checkoutName,
  checkoutPhone,
  checkoutAddress,
  paymentMethod,
  dataConsent,
  marketingConsent,
  idempotencyKey,
  cartItems,
}: {
  shopId: string;
  checkoutName: string;
  checkoutPhone: string;
  checkoutAddress: string;
  paymentMethod: StorefrontPaymentMethod;
  dataConsent: boolean;
  marketingConsent: boolean;
  idempotencyKey: string;
  cartItems: StorefrontCartItem[];
}): StorefrontCheckoutPayload {
  return {
    shop_id: shopId,
    customer_name: checkoutName.trim(),
    customer_phone: checkoutPhone.trim(),
    delivery_address: checkoutAddress.trim() || null,
    payment_method: paymentMethod,
    data_consent: dataConsent,
    marketing_consent: marketingConsent,
    idempotency_key: idempotencyKey,
    items: cartItems.map((cartItem) => ({
      product_id: cartItem.product.id,
      quantity: cartItem.qty,
    })),
  };
}

export function buildStorefrontWhatsAppLink({
  shop,
  checkoutName,
  checkoutPhone,
  checkoutAddress,
  paymentMethod,
  cartItems,
  cartTotal,
  order,
}: {
  shop: StorefrontShop;
  checkoutName: string;
  checkoutPhone: string;
  checkoutAddress: string;
  paymentMethod: StorefrontPaymentMethod;
  cartItems: StorefrontCartItem[];
  cartTotal: number;
  order?: Pick<StorefrontCheckoutResult, 'invoice_number' | 'total_paise'>;
}): string {
  const cleanPhone = (shop.owner_phone ?? '').replace(/[^0-9]/g, '');
  const whatsappPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  const confirmedTotal = order?.total_paise ?? cartTotal;

  const lines: string[] = [];
  lines.push(`*New Order from ${shop.business_name} Store*`);
  lines.push('');
  if (order?.invoice_number) lines.push(`*Order No:* ${order.invoice_number}`);
  lines.push(`*Customer:* ${checkoutName || 'Guest'}`);
  if (checkoutPhone) lines.push(`*Phone:* ${checkoutPhone}`);
  if (checkoutAddress) lines.push(`*Address:* ${checkoutAddress}`);
  lines.push(`*Payment:* ${paymentMethod === 'upi' ? 'UPI' : 'Khata (Pay Later)'}`);
  lines.push('');
  lines.push('*Order Items:*');

  for (const cartItem of cartItems) {
    const price = formatStorefrontPrice(cartItem.product.selling_price_paise * cartItem.qty);
    lines.push(`${cartItem.qty}x ${cartItem.product.name} — ${price}`);
  }

  lines.push('');
  lines.push(`*Total: ${formatStorefrontPrice(confirmedTotal)}*`);

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
