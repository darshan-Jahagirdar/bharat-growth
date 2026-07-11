'use client';

// =============================================================================
// BharatGrowth — Festive Theme (Warm, Vibrant, Grid-heavy)
// Best for: Sweet shops, Bakeries, Food stalls
// =============================================================================

import type { StorefrontShop, StorefrontProduct } from '@/lib/storefront/queries';
import { WhatsAppButton } from './WhatsAppButton';
import Image from 'next/image';

interface FestiveThemeProps {
  shop: StorefrontShop;
  products: StorefrontProduct[];
}

function formatPrice(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function groupByCategory(products: StorefrontProduct[]): Record<string, StorefrontProduct[]> {
  const groups: Record<string, StorefrontProduct[]> = {};
  for (const p of products) {
    const cat = p.category ?? 'Specialities';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  return groups;
}

export function FestiveTheme({ shop, products }: FestiveThemeProps) {
  const grouped = groupByCategory(products);
  const pc = shop.primary_color;

  // Derive a warm gradient for festive feel
  return (
    <div className="min-h-screen bg-amber-50 text-stone-900">
      {/* ── Header with warm gradient ── */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${pc} 0%, #f59e0b 50%, #ef4444 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%),
                               radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)`,
            }}
          />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-8 sm:px-6 text-center text-white">
          {shop.logo_url && (
            <Image
              src={shop.logo_url}
              alt={shop.business_name}
              width={80}
              height={80}
              unoptimized
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white/30 shadow-lg"
            />
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold drop-shadow-md">
            {shop.business_name}
          </h1>
          {shop.city && (
            <p className="mt-2 text-white/80 text-sm font-medium">
              {shop.city}
            </p>
          )}
          <p className="mt-3 text-white/70 text-xs">
            Browse our catalog and order via WhatsApp
          </p>
        </div>
      </header>

      {/* ── Product Grid ── */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-2xl">
                {category.toLowerCase().includes('sweet') ? '🍬' :
                 category.toLowerCase().includes('snack') ? '🍿' :
                 category.toLowerCase().includes('milk') ? '🥛' : '✨'}
              </span>
              <h2 className="text-xl font-bold text-stone-800">
                {category}
              </h2>
              <div className="flex-1 h-px bg-stone-200 ml-2" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Product image */}
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={640}
                      height={360}
                      unoptimized
                      className="w-full h-32 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div
                      className="w-full h-32 sm:h-36 flex items-center justify-center text-5xl"
                      style={{ backgroundColor: `${pc}10` }}
                    >
                      {category.toLowerCase().includes('sweet') ? '🍪' :
                       category.toLowerCase().includes('namkeen') ? '🥨' : '🎁'}
                    </div>
                  )}

                  <div className="p-3">
                    <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-stone-400 mb-2">
                      per {product.unit}
                    </p>

                    <p className="text-lg font-bold" style={{ color: pc }}>
                      {formatPrice(product.selling_price_paise)}
                    </p>

                    {/* WhatsApp Buy */}
                    {shop.owner_phone && (
                      <WhatsAppButton
                        ownerPhone={shop.owner_phone}
                        productName={product.name}
                        pricePaise={product.selling_price_paise}
                        primaryColor="#25D366"
                        className="mt-2 w-full py-2 text-xs"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {products.length === 0 && (
          <div className="text-center py-20 text-stone-400">
            <p className="text-5xl mb-4">🎉</p>
            <p className="text-lg">Menu coming soon!</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className="py-6 text-center text-white/60 text-xs"
        style={{ backgroundColor: pc }}
      >
        <p>Powered by BharatGrowth</p>
      </footer>
    </div>
  );
}
