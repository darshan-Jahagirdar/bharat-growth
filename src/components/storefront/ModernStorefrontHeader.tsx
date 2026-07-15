import type { RefObject } from 'react';
import Image from 'next/image';
import type { StorefrontShop } from '@/lib/storefront/queries';
import type { ModernStorefrontCatalogController } from '@/lib/storefront/useModernStorefrontCatalog';

interface ModernStorefrontHeaderProps {
  catalog: ModernStorefrontCatalogController;
  pillsRef: RefObject<HTMLDivElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  shop: StorefrontShop;
}

export function ModernStorefrontHeader({
  catalog,
  pillsRef,
  searchRef,
  shop,
}: ModernStorefrontHeaderProps) {
  const {
    activeCategory,
    categories,
    searchQuery,
    setActiveCategory,
    setSearchQuery,
  } = catalog;

  return (
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
            onChange={(event) => setSearchQuery(event.target.value)}
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

      <div
        ref={pillsRef}
        className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
              ${activeCategory === category
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
          >
            {category}
          </button>
        ))}
      </div>
    </header>
  );
}
