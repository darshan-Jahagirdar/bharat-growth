import type { RefObject } from 'react';
import type { Product } from '@/lib/types/database';
import { formatINR } from '@/lib/types/database';

interface ProductSearchBarProps {
  productSearchRef: RefObject<HTMLInputElement | null>;
  query: string;
  showDropdown: boolean;
  products: Product[];
  lineItemCount: number;
  onQueryChange: (query: string) => void;
  onShowDropdownChange: (show: boolean) => void;
  onAddProduct: (product: Product) => void;
}

export function ProductSearchBar({
  productSearchRef,
  query,
  showDropdown,
  products,
  lineItemCount,
  onQueryChange,
  onShowDropdownChange,
  onAddProduct,
}: ProductSearchBarProps) {
  return (
    <div className="h-11 min-h-[44px] bg-gray-900/30 border-b border-gray-800 flex items-center px-4 gap-4">
      <div className="relative flex-1 max-w-lg">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs w-20">Add Item</span>
          <input
            ref={productSearchRef}
            type="text"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onShowDropdownChange(true);
            }}
            onFocus={() => onShowDropdownChange(true)}
            onBlur={() => setTimeout(() => onShowDropdownChange(false), 200)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && products.length > 0) {
                event.preventDefault();
                onAddProduct(products[0]);
              }
            }}
            placeholder="Search product, SKU, or HSN... (F3)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                       focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50
                       placeholder-gray-600"
          />
        </div>
        {showDropdown && products.length > 0 && (
          <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-48 overflow-y-auto">
            {products.map((product) => (
              <button
                key={product.id}
                onMouseDown={() => onAddProduct(product)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex justify-between items-center"
              >
                <div>
                  <span className="text-white">{product.name}</span>
                  <span className="text-gray-600 text-xs ml-2">HSN: {product.hsn_code}</span>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 text-xs font-medium">
                    {formatINR(product.selling_price_paise)}
                  </span>
                  <span className="text-gray-600 text-xs ml-2">{product.gst_rate_percent}%</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="text-gray-700 text-[10px]">
        {lineItemCount} item{lineItemCount !== 1 ? 's' : ''} in bill
      </span>
    </div>
  );
}
