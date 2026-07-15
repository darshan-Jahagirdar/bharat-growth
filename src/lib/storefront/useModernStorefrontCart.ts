'use client';

import { useCallback, useState } from 'react';
import type { StorefrontProduct } from '@/lib/storefront/queries';
import {
  addStorefrontCartItem,
  getStorefrontCartItems,
  getStorefrontCartQuantity,
  getStorefrontStockMessage,
  removeStorefrontCartItem,
  summarizeStorefrontCart,
  type StorefrontCart,
} from './modernStorefrontTransforms';

export function useModernStorefrontCart() {
  const [cart, setCart] = useState<StorefrontCart>(new Map());
  const [stockToast, setStockToast] = useState('');
  const cartItems = getStorefrontCartItems(cart);
  const { count: cartCount, totalPaise: cartTotal } = summarizeStorefrontCart(cartItems);

  const addToCart = useCallback((product: StorefrontProduct) => {
    const stockMessage = getStorefrontStockMessage(cart, product);
    if (stockMessage) {
      setStockToast(stockMessage);
      setTimeout(() => setStockToast(''), 2500);
      return;
    }
    setCart((previous) => addStorefrontCartItem(previous, product));
  }, [cart]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((previous) => removeStorefrontCartItem(previous, productId));
  }, []);

  const getQty = useCallback((productId: string): number => {
    return getStorefrontCartQuantity(cart, productId);
  }, [cart]);

  const clearCart = useCallback(() => {
    setCart(new Map());
  }, []);

  return {
    addToCart,
    cartCount,
    cartItems,
    cartTotal,
    clearCart,
    getQty,
    removeFromCart,
    stockToast,
  };
}

export type ModernStorefrontCartController = ReturnType<
  typeof useModernStorefrontCart
>;
