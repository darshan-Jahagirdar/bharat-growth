import { formatStorefrontPrice } from '@/lib/storefront/modernStorefrontTransforms';

interface ModernStorefrontCartBarProps {
  cartCount: number;
  cartTotal: number;
  onCheckout: () => void;
}

export function ModernStorefrontCartBar({
  cartCount,
  cartTotal,
  onCheckout,
}: ModernStorefrontCartBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3">
      <button
        onClick={onCheckout}
        className="w-full flex items-center justify-between bg-brand text-white
                   rounded-2xl px-5 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]
                   active:bg-orange-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 px-2.5 py-1">
            <span className="font-mono text-sm font-bold">{cartCount}</span>
          </div>
          <div className="text-left">
            <p className="text-[11px] leading-tight text-orange-100">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </p>
            <p className="font-mono text-base font-bold leading-tight">{formatStorefrontPrice(cartTotal)}</p>
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
  );
}
