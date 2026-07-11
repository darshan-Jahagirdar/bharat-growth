'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { StorefrontShop, StorefrontProduct } from '@/lib/storefront/queries';
import Image from 'next/image';

interface ModernThemeProps {
  shop: StorefrontShop;
  products: StorefrontProduct[];
}

interface CartItem {
  product: StorefrontProduct;
  qty: number;
}

interface CheckoutResult {
  order_id: string;
  invoice_number: string;
  total_paise: number;
}

// RFC4122 v4 key for storefront checkout idempotency. Uses crypto.randomUUID
// when available (secure contexts) and falls back for non-secure dev origins.
function genIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatPrice(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const PLACEHOLDER_COLORS = [
  '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#F59E0B', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6',
];

function getPlaceholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function getCategories(products: StorefrontProduct[]): string[] {
  const cats = new Set<string>();
  for (const p of products) {
    if (p.category) cats.add(p.category);
  }
  return ['All', ...Array.from(cats).sort()];
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function ModernTheme({ shop, products }: ModernThemeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'khata'>('upi');
  const [dataConsent, setDataConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stockToast, setStockToast] = useState('');
  const pillsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Persists across retries of the same checkout attempt; cleared on success.
  const idempotencyKeyRef = useRef<string | null>(null);

  const categories = getCategories(products);

  const filtered = products.filter((p) => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    if (!searchQuery.trim()) return matchesCategory;
    const q = searchQuery.toLowerCase();
    return matchesCategory && (
      p.name.toLowerCase().includes(q) ||
      (p.category?.toLowerCase().includes(q) ?? false)
    );
  });

  const cartItems = Array.from(cart.values());
  const cartCount = cartItems.reduce((sum, ci) => sum + ci.qty, 0);
  const cartTotal = cartItems.reduce((sum, ci) => sum + ci.product.selling_price_paise * ci.qty, 0);

  const addToCart = useCallback((product: StorefrontProduct) => {
    // Stock clamp: check BEFORE updating state so we can fire toast
    const currentQty = cart.get(product.id)?.qty ?? 0;
    if (product.is_stock_tracked && product.stock_quantity !== null) {
      if (currentQty + 1 > product.stock_quantity) {
        setStockToast(`Only ${product.stock_quantity} available in stock`);
        setTimeout(() => setStockToast(''), 2500);
        return; // hard stop — do NOT update cart
      }
    }

    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      if (existing) {
        next.set(product.id, { ...existing, qty: existing.qty + 1 });
      } else {
        next.set(product.id, { product, qty: 1 });
      }
      return next;
    });
  }, [cart]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      if (existing.qty <= 1) {
        next.delete(productId);
      } else {
        next.set(productId, { ...existing, qty: existing.qty - 1 });
      }
      return next;
    });
  }, []);

  const getQty = useCallback((productId: string): number => {
    return cart.get(productId)?.qty ?? 0;
  }, [cart]);

  useEffect(() => {
    if (showCheckout) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCheckout]);

  const buildWhatsAppLink = (order?: Pick<CheckoutResult, 'invoice_number' | 'total_paise'>): string => {
    const cleanPhone = (shop.owner_phone ?? '').replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
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

    for (const ci of cartItems) {
      const price = formatPrice(ci.product.selling_price_paise * ci.qty);
      lines.push(`${ci.qty}x ${ci.product.name} — ${price}`);
    }

    lines.push('');
    lines.push(`*Total: ${formatPrice(confirmedTotal)}*`);

    const message = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${waPhone}?text=${message}`;
  };

  const handlePlaceOrder = async () => {
    if (!checkoutName.trim() || !checkoutPhone.trim() || !dataConsent) return;
    setIsSubmitting(true);
    setSubmitError('');

    // Reuse the same key across retries of this attempt so a lost response or
    // rapid double-submit collapses to a single order server-side.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = genIdempotencyKey();
    }

    const payload = {
      shop_id: shop.id,
      customer_name: checkoutName.trim(),
      customer_phone: checkoutPhone.trim(),
      delivery_address: checkoutAddress.trim() || null,
      payment_method: paymentMethod,
      data_consent: dataConsent,
      marketing_consent: marketingConsent,
      idempotency_key: idempotencyKeyRef.current,
      items: cartItems.map((ci) => ({
        product_id: ci.product.id,
        quantity: ci.qty,
      })),
    };

    let res: Response;
    try {
      res = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : 'Network error';
      setSubmitError(`Network error: ${msg}`);
      setIsSubmitting(false);
      return; // ← HARD STOP, no WhatsApp
    }


    if (!res.ok) {
      let errorMsg = `Order failed (HTTP ${res.status})`;
      try {
        const errBody = await res.json();
        errorMsg = errBody.error || errorMsg;
      } catch {
        errorMsg = `Order failed (HTTP ${res.status})`;
      }
      setSubmitError(errorMsg);
      setIsSubmitting(false);
      return; // ← HARD STOP, no WhatsApp
    }

    let orderResult: CheckoutResult | undefined;

    // Only reach here on 200 OK
    try {
      orderResult = await res.json();
    } catch {
      // Response was 200 but no JSON body — still success
    }

    const waUrl = buildWhatsAppLink(orderResult);
    // Order created - retire this key so the next cart starts a fresh attempt.
    idempotencyKeyRef.current = null;
    setCart(new Map());
    setShowCheckout(false);
    setCheckoutName('');
    setCheckoutPhone('');
    setCheckoutAddress('');
    setDataConsent(false);
    setIsSubmitting(false);
    // Use location.href instead of window.open to avoid popup blockers
    // on mobile browsers after async fetch
    window.location.href = waUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Stock limit toast ── */}
      {stockToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl
                        bg-red-600 text-white text-sm font-semibold shadow-lg
                        animate-[fadeIn_0.2s_ease-out]">
          {stockToast}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STICKY HEADER: Shop Name + Search
          ════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3 mb-2.5">
            {shop.logo_url ? (
              <Image
                src={shop.logo_url}
                alt={shop.business_name}
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: shop.primary_color }}
              >
                {shop.business_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate leading-tight">
                {shop.business_name}
              </h1>
              {shop.city && (
                <p className="text-[11px] text-gray-400 leading-tight">{shop.city}</p>
              )}
            </div>
          </div>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${shop.business_name}...`}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900
                         placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30
                         focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Category Pills ── */}
        <div
          ref={pillsRef}
          className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
                ${activeCategory === cat
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          PRODUCT GRID: 2-column cards
          ════════════════════════════════════════════════════════════════ */}
      <main className="px-3 pt-3 pb-32">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((product) => {
              const qty = getQty(product.id);
              const placeholderBg = getPlaceholderColor(product.name);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden
                             border border-gray-100/80 flex flex-col"
                >
                  {/* Product Image / Placeholder */}
                  {product.image_url ? (
                    <div className="relative aspect-square bg-gray-50">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 320px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="relative aspect-square flex items-center justify-center"
                      style={{ backgroundColor: `${placeholderBg}12` }}
                    >
                      <span
                        className="text-5xl font-bold opacity-30"
                        style={{ color: placeholderBg }}
                      >
                        {product.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Product Info + Add Button */}
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-0.5">
                      {product.name}
                    </h3>
                    {product.unit !== 'piece' && (
                      <p className="text-[10px] text-gray-400 mb-1.5">per {product.unit}</p>
                    )}

                    <div className="mt-auto flex items-end justify-between gap-1.5">
                      <div>
                        <p className="text-base font-bold text-gray-900 leading-none">
                          {formatPrice(product.selling_price_paise)}
                        </p>
                        {product.is_stock_tracked && product.stock_quantity !== null && product.stock_quantity <= 0 && (
                          <p className="text-[9px] text-red-500 font-semibold mt-0.5">Out of Stock</p>
                        )}
                      </div>

                      {/* Strict-Block: tracked + stock <= 0 → disabled */}
                      {product.is_stock_tracked && product.stock_quantity !== null && product.stock_quantity <= 0 && qty === 0 ? (
                        <button
                          disabled
                          className="px-4 py-1.5 rounded-lg text-xs font-bold border-2 border-gray-300
                                     text-gray-400 bg-gray-100 cursor-not-allowed"
                        >
                          ADD
                        </button>
                      ) : qty === 0 ? (
                        <button
                          onClick={() => addToCart(product)}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold border-2 border-green-600
                                     text-green-600 bg-green-50 active:bg-green-100 transition-all"
                        >
                          ADD
                        </button>
                      ) : (
                        <div className="flex items-center bg-green-600 rounded-lg overflow-hidden shadow-sm">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="w-8 h-8 flex items-center justify-center text-white text-lg
                                       font-bold active:bg-green-700 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-white text-sm font-bold">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={product.is_stock_tracked && product.stock_quantity !== null && qty >= product.stock_quantity}
                            className="w-8 h-8 flex items-center justify-center text-white text-lg
                                       font-bold active:bg-green-700 transition-colors disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════
          FLOATING CART BAR
          ════════════════════════════════════════════════════════════════ */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full flex items-center justify-between bg-green-600 text-white
                       rounded-2xl px-5 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]
                       active:bg-green-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-2 py-1">
                <span className="text-sm font-bold">{cartCount}</span>
              </div>
              <div className="text-left">
                <p className="text-[11px] text-green-100 leading-tight">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </p>
                <p className="text-base font-bold leading-tight">{formatPrice(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">Checkout</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CHECKOUT DRAWER
          ════════════════════════════════════════════════════════════════ */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCheckout(false)}
          />

          {/* Slide-up drawer */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto
                          animate-[slideUp_0.3s_ease-out]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pb-8">
              {/* Title */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Your Order</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Cart Items */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-3">
                {cartItems.map((ci) => (
                  <div key={ci.product.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{ci.product.name}</p>
                      <p className="text-xs text-gray-400">{formatPrice(ci.product.selling_price_paise)} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => removeFromCart(ci.product.id)}
                          className="w-7 h-7 flex items-center justify-center text-gray-500
                                     active:bg-gray-100 text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-gray-900">{ci.qty}</span>
                        <button
                          onClick={() => addToCart(ci.product)}
                          className="w-7 h-7 flex items-center justify-center text-green-600
                                     active:bg-gray-100 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                        {formatPrice(ci.product.selling_price_paise * ci.qty)}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">{formatPrice(cartTotal)}</span>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Details</p>
                <input
                  type="text"
                  value={checkoutName}
                  onChange={(e) => setCheckoutName(e.target.value)}
                  placeholder="Your Name *"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30
                             focus:bg-white border border-transparent focus:border-green-500/30"
                />
                <input
                  type="tel"
                  value={checkoutPhone}
                  onChange={(e) => setCheckoutPhone(e.target.value)}
                  placeholder="Phone Number *"
                  maxLength={10}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30
                             focus:bg-white border border-transparent focus:border-green-500/30"
                />
                <textarea
                  value={checkoutAddress}
                  onChange={(e) => setCheckoutAddress(e.target.value)}
                  placeholder="Delivery Address (optional)"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900
                             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30
                             focus:bg-white border border-transparent focus:border-green-500/30 resize-none"
                />
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Payment</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setPaymentMethod('upi')}
                    className={`py-3.5 rounded-xl text-sm font-semibold border-2 transition-all
                      ${paymentMethod === 'upi'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                      }`}
                  >
                    📱 Pay via UPI
                  </button>
                  <button
                    onClick={() => setPaymentMethod('khata')}
                    className={`py-3.5 rounded-xl text-sm font-semibold border-2 transition-all
                      ${paymentMethod === 'khata'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                      }`}
                  >
                    📒 Add to Khata
                  </button>
                </div>
              </div>

              <label className="mb-3 flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={dataConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs leading-5 text-gray-600">
                  I agree to share my name, phone, address, and order details with this shop for fulfilling this order.
                </span>
              </label>

              {/* Optional marketing opt-in — never gates the order (DPDP) */}
              <label className="mb-5 flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs leading-5 text-gray-600">
                  Send me offers &amp; reminders on WhatsApp <span className="text-gray-400">(optional)</span>
                </span>
              </label>

              {/* Error message */}
              {submitError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm mb-3">
                  {submitError}
                </div>
              )}

              {/* Place Order via WhatsApp */}
              {shop.owner_phone ? (
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting || !checkoutName.trim() || !checkoutPhone.trim() || !dataConsent}
                  className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white
                             text-base font-bold shadow-lg active:scale-[0.98] transition-all
                             ${isSubmitting || !checkoutName.trim() || !checkoutPhone.trim() || !dataConsent
                               ? 'bg-gray-300'
                               : 'bg-[#25D366] shadow-green-200'
                             }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon className="w-5 h-5" />
                      Place Order on WhatsApp
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl bg-gray-100 text-center text-sm text-gray-400">
                  Shop contact not available
                </div>
              )}

              <p className="text-center text-[10px] text-gray-300 mt-3">
                Powered by BharatGrowth
              </p>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
