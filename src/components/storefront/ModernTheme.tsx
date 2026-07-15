'use client';

import { useRef } from 'react';
import type { StorefrontShop, StorefrontProduct } from '@/lib/storefront/queries';
import { useModernStorefrontCatalog } from '@/lib/storefront/useModernStorefrontCatalog';
import { useModernStorefrontCart } from '@/lib/storefront/useModernStorefrontCart';
import { useModernStorefrontCheckout } from '@/lib/storefront/useModernStorefrontCheckout';
import { ModernStorefrontCartBar } from './ModernStorefrontCartBar';
import { ModernStorefrontCheckoutDrawer } from './ModernStorefrontCheckoutDrawer';
import { ModernStorefrontHeader } from './ModernStorefrontHeader';
import { ModernStorefrontProductGrid } from './ModernStorefrontProductGrid';

interface ModernThemeProps {
  shop: StorefrontShop;
  products: StorefrontProduct[];
}

export function ModernTheme({ shop, products }: ModernThemeProps) {
  const pillsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const catalog = useModernStorefrontCatalog(products);
  const cart = useModernStorefrontCart();
  const checkout = useModernStorefrontCheckout({
    cartItems: cart.cartItems,
    cartTotal: cart.cartTotal,
    clearCart: cart.clearCart,
    shop,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {cart.stockToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl
                        bg-red-600 text-white text-sm font-semibold shadow-lg
                        animate-[fadeIn_0.2s_ease-out]">
          {cart.stockToast}
        </div>
      )}

      <ModernStorefrontHeader
        catalog={catalog}
        pillsRef={pillsRef}
        searchRef={searchRef}
        shop={shop}
      />
      <ModernStorefrontProductGrid
        cart={cart}
        products={catalog.filteredProducts}
      />

      {cart.cartCount > 0 && (
        <ModernStorefrontCartBar
          cartCount={cart.cartCount}
          cartTotal={cart.cartTotal}
          onCheckout={() => checkout.setShowCheckout(true)}
        />
      )}

      {checkout.showCheckout && (
        <ModernStorefrontCheckoutDrawer
          cart={cart}
          checkout={checkout}
          shop={shop}
        />
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
