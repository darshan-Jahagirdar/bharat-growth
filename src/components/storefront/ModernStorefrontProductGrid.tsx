import Image from 'next/image';
import type { StorefrontProduct } from '@/lib/storefront/queries';
import {
  formatStorefrontPrice,
  getStorefrontPlaceholderColor,
} from '@/lib/storefront/modernStorefrontTransforms';
import type { ModernStorefrontCartController } from '@/lib/storefront/useModernStorefrontCart';

interface ModernStorefrontProductGridProps {
  cart: ModernStorefrontCartController;
  products: StorefrontProduct[];
}

// The storefront product payload carries stock_quantity but not the product's
// own low_stock_threshold, so the "Only N left" tier uses a fixed count.
const LOW_STOCK_BADGE_AT = 5

// The design marks top sellers. There is no ranking source on the storefront
// payload yet, so this reads the flag defensively rather than adding a field to
// src/lib/storefront/storefrontQueryTypes.ts, which another contributor owns.
// The badge stays hidden until the query starts returning is_best_seller, and
// lights up on its own once it does — no change needed here.
function isBestSeller(product: StorefrontProduct): boolean {
  return (product as { is_best_seller?: boolean }).is_best_seller === true
}

function BestSellerBadge({ product }: { product: StorefrontProduct }) {
  if (!isBestSeller(product)) return null
  return (
    <span className="absolute right-2 top-2 z-10 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Best seller
    </span>
  )
}

function StockBadge({ product }: { product: StorefrontProduct }) {
  if (!product.is_stock_tracked || product.stock_quantity === null) return null

  const base =
    'absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold'

  if (product.stock_quantity <= 0) {
    return <span className={`${base} bg-red-50 text-red-600`}>Out of stock</span>
  }
  if (product.stock_quantity <= LOW_STOCK_BADGE_AT) {
    return (
      <span className={`${base} bg-red-50 text-red-600`}>
        Only {product.stock_quantity} left
      </span>
    )
  }
  return <span className={`${base} bg-emerald-50 text-emerald-700`}>In stock</span>
}

export function ModernStorefrontProductGrid({
  cart,
  products,
}: ModernStorefrontProductGridProps) {
  return (
    <main className="px-3 pt-3 pb-32">
      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-400 text-sm">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {products.map((product) => {
            const qty = cart.getQty(product.id);
            const placeholderBg = getStorefrontPlaceholderColor(product.name);

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden
                           border border-gray-100/80 flex flex-col"
              >
                <div className="relative">
                  <StockBadge product={product} />
                  <BestSellerBadge product={product} />
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
                </div>

                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-0.5">
                    {product.name}
                  </h3>
                  {product.unit !== 'piece' && (
                    <p className="text-[10px] text-gray-400 mb-1.5">per {product.unit}</p>
                  )}

                  <div className="mt-auto flex items-end justify-between gap-1.5">
                    <div>
                      <p className="font-mono text-base font-bold text-gray-900 leading-none">
                        {formatStorefrontPrice(product.selling_price_paise)}
                      </p>
                    </div>

                    {product.is_stock_tracked && product.stock_quantity !== null && product.stock_quantity <= 0 && qty === 0 ? (
                      <button
                        disabled
                        aria-label="ADD"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                   bg-gray-100 text-xl font-bold text-gray-300 cursor-not-allowed"
                      >
                        +
                      </button>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => cart.addToCart(product)}
                        aria-label="ADD"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                   bg-brand text-xl font-bold text-white shadow-sm
                                   active:bg-orange-600 transition-colors"
                      >
                        +
                      </button>
                    ) : (
                      <div className="flex items-center overflow-hidden rounded-full bg-brand shadow-sm">
                        <button
                          onClick={() => cart.removeFromCart(product.id)}
                          className="flex h-9 w-8 items-center justify-center text-lg
                                     font-bold text-white active:bg-orange-600 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-bold text-white">
                          {qty}
                        </span>
                        <button
                          onClick={() => cart.addToCart(product)}
                          disabled={product.is_stock_tracked && product.stock_quantity !== null && qty >= product.stock_quantity}
                          className="flex h-9 w-8 items-center justify-center text-lg
                                     font-bold text-white active:bg-orange-600 transition-colors disabled:opacity-40"
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
  );
}
