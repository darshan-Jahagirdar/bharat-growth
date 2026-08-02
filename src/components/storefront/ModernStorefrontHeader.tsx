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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-brand">
              {shop.business_name}
            </h1>
            {shop.city && (
              <p className="text-xs leading-tight text-gray-500">{shop.city}</p>
            )}
          </div>

          {shop.owner_phone && (
            <a
              href={`https://wa.me/${
                shop.owner_phone.replace(/[^0-9]/g, '').startsWith('91')
                  ? shop.owner_phone.replace(/[^0-9]/g, '')
                  : `91${shop.owner_phone.replace(/[^0-9]/g, '')}`
              }`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message ${shop.business_name} on WhatsApp`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          )}
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
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30
                       focus:border-brand/40 transition-all"
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
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all
              ${activeCategory === category
                ? 'bg-brand text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
              }`}
          >
            {category}
          </button>
        ))}
      </div>
    </header>
  );
}
