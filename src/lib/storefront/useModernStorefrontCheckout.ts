'use client';

import { useEffect, useRef, useState } from 'react';
import type { StorefrontShop } from '@/lib/storefront/queries';
import {
  buildStorefrontCheckoutPayload,
  buildStorefrontWhatsAppLink,
  type StorefrontCartItem,
  type StorefrontCheckoutResult,
  type StorefrontPaymentMethod,
} from './modernStorefrontTransforms';

interface UseModernStorefrontCheckoutOptions {
  cartItems: StorefrontCartItem[];
  cartTotal: number;
  clearCart: () => void;
  shop: StorefrontShop;
}

// RFC4122 v4 key for storefront checkout idempotency. Uses crypto.randomUUID
// when available (secure contexts) and falls back for non-secure dev origins.
function genIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function useModernStorefrontCheckout({
  cartItems,
  cartTotal,
  clearCart,
  shop,
}: UseModernStorefrontCheckoutOptions) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<StorefrontPaymentMethod>('upi');
  const [dataConsent, setDataConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Persists across retries of the same checkout attempt; cleared on success.
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (showCheckout) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCheckout]);

  const handlePlaceOrder = async () => {
    if (!checkoutName.trim() || !checkoutPhone.trim() || !dataConsent) return;
    setIsSubmitting(true);
    setSubmitError('');

    // Reuse the same key across retries of this attempt so a lost response or
    // rapid double-submit collapses to a single order server-side.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = genIdempotencyKey();
    }

    const payload = buildStorefrontCheckoutPayload({
      shopId: shop.id,
      checkoutName,
      checkoutPhone,
      checkoutAddress,
      paymentMethod,
      dataConsent,
      marketingConsent,
      idempotencyKey: idempotencyKeyRef.current,
      cartItems,
    });

    let response: Response;
    try {
      response = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Network error';
      setSubmitError(`Network error: ${message}`);
      setIsSubmitting(false);
      return;
    }

    if (!response.ok) {
      let errorMessage = `Order failed (HTTP ${response.status})`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorMessage;
      } catch {
        errorMessage = `Order failed (HTTP ${response.status})`;
      }
      setSubmitError(errorMessage);
      setIsSubmitting(false);
      return;
    }

    let orderResult: StorefrontCheckoutResult | undefined;
    try {
      orderResult = await response.json();
    } catch {
      // Response was 200 but no JSON body — still success.
    }

    const whatsappUrl = buildStorefrontWhatsAppLink({
      shop,
      checkoutName,
      checkoutPhone,
      checkoutAddress,
      paymentMethod,
      cartItems,
      cartTotal,
      order: orderResult,
    });
    idempotencyKeyRef.current = null;
    clearCart();
    setShowCheckout(false);
    setCheckoutName('');
    setCheckoutPhone('');
    setCheckoutAddress('');
    setDataConsent(false);
    setIsSubmitting(false);
    // Use location.href instead of window.open to avoid popup blockers
    // on mobile browsers after async fetch.
    window.location.href = whatsappUrl;
  };

  return {
    checkoutAddress,
    checkoutName,
    checkoutPhone,
    dataConsent,
    handlePlaceOrder,
    isSubmitting,
    marketingConsent,
    paymentMethod,
    setCheckoutAddress,
    setCheckoutName,
    setCheckoutPhone,
    setDataConsent,
    setMarketingConsent,
    setPaymentMethod,
    setShowCheckout,
    showCheckout,
    submitError,
  };
}

export type ModernStorefrontCheckoutController = ReturnType<
  typeof useModernStorefrontCheckout
>;
