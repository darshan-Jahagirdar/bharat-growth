import type { StorefrontShop } from '@/lib/storefront/queries';
import { formatStorefrontPrice } from '@/lib/storefront/modernStorefrontTransforms';
import type { ModernStorefrontCartController } from '@/lib/storefront/useModernStorefrontCart';
import type { ModernStorefrontCheckoutController } from '@/lib/storefront/useModernStorefrontCheckout';

interface ModernStorefrontCheckoutDrawerProps {
  cart: ModernStorefrontCartController;
  checkout: ModernStorefrontCheckoutController;
  shop: StorefrontShop;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function ModernStorefrontCheckoutDrawer({
  cart,
  checkout,
  shop,
}: ModernStorefrontCheckoutDrawerProps) {
  const {
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
    submitError,
  } = checkout;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowCheckout(false)}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto
                      animate-[slideUp_0.3s_ease-out]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8">
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

          <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-3">
            {cart.cartItems.map((cartItem) => (
              <div key={cartItem.product.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{cartItem.product.name}</p>
                  <p className="font-mono text-xs text-gray-400">{formatStorefrontPrice(cartItem.product.selling_price_paise)} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <button
                      onClick={() => cart.removeFromCart(cartItem.product.id)}
                      className="flex h-8 w-8 items-center justify-center text-sm
                                 font-bold text-gray-500 active:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-semibold text-gray-900">{cartItem.qty}</span>
                    <button
                      onClick={() => cart.addToCart(cartItem.product)}
                      className="flex h-8 w-8 items-center justify-center text-sm
                                 font-bold text-brand active:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 text-right font-mono text-sm font-semibold text-gray-900">
                    {formatStorefrontPrice(cartItem.product.selling_price_paise * cartItem.qty)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-5 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Grand Total</p>
              <p className="text-xs text-gray-500">Including taxes</p>
            </div>
            <span className="font-mono text-2xl font-bold tracking-tight text-gray-900">
              {formatStorefrontPrice(cart.cartTotal)}
            </span>
          </div>

          <div className="mb-5 space-y-3">
            <p className="text-base font-bold text-gray-900">Your Details</p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Full Name</span>
              <input
                type="text"
                value={checkoutName}
                onChange={(event) => setCheckoutName(event.target.value)}
                placeholder="Your Name *"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900
                           placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30
                           focus:border-brand/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">Phone Number</span>
              <input
                type="tel"
                value={checkoutPhone}
                onChange={(event) => setCheckoutPhone(event.target.value)}
                placeholder="Phone Number *"
                maxLength={10}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900
                           placeholder:font-sans placeholder:text-gray-400 focus:outline-none focus:ring-2
                           focus:ring-brand/30 focus:border-brand/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-700">
                Delivery Address <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <textarea
                value={checkoutAddress}
                onChange={(event) => setCheckoutAddress(event.target.value)}
                placeholder="Delivery Address (optional)"
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900
                           placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30
                           focus:border-brand/40"
              />
            </label>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Payment</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setPaymentMethod('upi')}
                className={`py-3.5 rounded-xl text-sm font-semibold border-2 transition-all
                  ${paymentMethod === 'upi'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
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
              onChange={(event) => setDataConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <span className="text-xs leading-5 text-gray-600">
              I agree to share my name, phone, address, and order details with this shop for fulfilling this order.
            </span>
          </label>

          <label className="mb-5 flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <span className="text-xs leading-5 text-gray-600">
              Send me offers &amp; reminders on WhatsApp <span className="text-gray-400">(optional)</span>
            </span>
          </label>

          {submitError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm mb-3">
              {submitError}
            </div>
          )}

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
  );
}
