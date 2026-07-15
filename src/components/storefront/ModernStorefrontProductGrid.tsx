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
                        {formatStorefrontPrice(product.selling_price_paise)}
                      </p>
                      {product.is_stock_tracked && product.stock_quantity !== null && product.stock_quantity <= 0 && (
                        <p className="text-[9px] text-red-500 font-semibold mt-0.5">Out of Stock</p>
                      )}
                    </div>

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
                        onClick={() => cart.addToCart(product)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold border-2 border-green-600
                                   text-green-600 bg-green-50 active:bg-green-100 transition-all"
                      >
                        ADD
                      </button>
                    ) : (
                      <div className="flex items-center bg-green-600 rounded-lg overflow-hidden shadow-sm">
                        <button
                          onClick={() => cart.removeFromCart(product.id)}
                          className="w-8 h-8 flex items-center justify-center text-white text-lg
                                     font-bold active:bg-green-700 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-white text-sm font-bold">
                          {qty}
                        </span>
                        <button
                          onClick={() => cart.addToCart(product)}
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
  );
}
