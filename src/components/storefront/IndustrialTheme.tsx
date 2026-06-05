'use client';

// =============================================================================
// BharatGrowth — Industrial Theme (Dark, Heavy, High Contrast)
// Best for: Hardware stores, Tyre shops, Auto parts
// =============================================================================

import type { StorefrontShop, StorefrontProduct } from '@/lib/storefront/queries';
import { WhatsAppButton } from './WhatsAppButton';

interface IndustrialThemeProps {
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
    const cat = p.category ?? 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  return groups;
}

export function IndustrialTheme({ shop, products }: IndustrialThemeProps) {
  const grouped = groupByCategory(products);
  const pc = shop.primary_color;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header
        className="border-b-4"
        style={{ borderColor: pc, background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-4">
            {shop.logo_url && (
              <img
                src={shop.logo_url}
                alt={shop.business_name}
                className="w-16 h-16 rounded-lg object-cover border-2 border-zinc-700"
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
                {shop.business_name}
              </h1>
              {shop.city && (
                <p className="text-zinc-400 text-sm mt-1 tracking-wide uppercase">
                  {shop.city}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Catalog ── */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 rounded-sm" style={{ backgroundColor: pc }} />
          <h2 className="text-xl font-bold uppercase tracking-wider text-zinc-300">
            Our Products ({products.length})
          </h2>
        </div>

        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-10">
            <h3
              className="text-sm font-bold uppercase tracking-widest mb-4 pb-2 border-b border-zinc-800"
              style={{ color: pc }}
            >
              {category}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col hover:border-zinc-600 transition-colors"
                >
                  {/* Product image */}
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-40 object-cover rounded-md mb-3 bg-zinc-800"
                    />
                  ) : (
                    <div
                      className="w-full h-40 rounded-md mb-3 flex items-center justify-center text-4xl font-black"
                      style={{ backgroundColor: `${pc}15`, color: pc }}
                    >
                      {product.name.charAt(0)}
                    </div>
                  )}

                  {/* Details */}
                  <h4 className="font-bold text-lg leading-tight mb-1">
                    {product.name}
                  </h4>
                  {product.sku && (
                    <p className="text-xs text-zinc-500 font-mono mb-2">
                      SKU: {product.sku}
                    </p>
                  )}

                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div>
                      <span className="text-2xl font-black" style={{ color: pc }}>
                        {formatPrice(product.selling_price_paise)}
                      </span>
                      <span className="text-xs text-zinc-500 ml-1">
                        /{product.unit}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Buy */}
                  {shop.owner_phone && (
                    <WhatsAppButton
                      ownerPhone={shop.owner_phone}
                      productName={product.name}
                      pricePaise={product.selling_price_paise}
                      primaryColor={pc}
                      className="mt-3 py-2.5 px-4 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {products.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-lg">No products listed yet.</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-6 text-center text-zinc-600 text-xs">
        <p>Powered by BharatGrowth</p>
      </footer>
    </div>
  );
}
