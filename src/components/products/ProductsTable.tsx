import Image from 'next/image';
import { formatINR, type Product } from '@/lib/types/database';
import type { CampaignTag, StockAdjustmentTarget } from '@/lib/products/productForm';

interface ProductsTableProps {
  onAdjustStock: (target: StockAdjustmentTarget) => void;
  onEdit: (product: Product) => void;
  products: Product[];
  search: string;
  stockMap: Map<string, number>;
  tags: CampaignTag[];
}

export function ProductsTable({
  onAdjustStock,
  onEdit,
  products,
  search,
  stockMap,
  tags,
}: ProductsTableProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900/80 border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 w-12">Image</th>
            <th className="text-left px-4 py-3">Product</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">HSN</th>
            <th className="text-left px-4 py-3 hidden lg:table-cell">SKU</th>
            <th className="text-right px-4 py-3">Price</th>
            <th className="text-center px-4 py-3 hidden md:table-cell">GST</th>
            <th className="text-center px-4 py-3 hidden lg:table-cell">Stock</th>
            <th className="text-center px-4 py-3 w-16">Status</th>
            <th className="text-center px-4 py-3 w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-12 text-gray-600">
                {search
                  ? 'No products match your search.'
                  : 'No products yet. Click "+ Add Product" to get started.'}
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="40px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 text-sm font-bold">
                        {product.name.charAt(0)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-200">{product.name}</div>
                  <div className="flex items-center gap-1.5">
                    {product.category && (
                      <span className="text-[11px] text-gray-500">{product.category}</span>
                    )}
                    {product.tag_id && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">
                        {tags.find((tag) => tag.id === product.tag_id)?.name ?? 'Tagged'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-gray-400 hidden md:table-cell">
                  {product.hsn_code}
                </td>
                <td className="px-4 py-3 font-mono text-gray-500 hidden lg:table-cell">
                  {product.sku ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-200">
                  {formatINR(product.selling_price_paise)}
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">
                    {product.gst_rate_percent}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  {product.is_stock_tracked ? (
                    <span className={`font-mono text-xs font-semibold ${
                      (stockMap.get(product.id) ?? 0) <= 0
                        ? 'text-red-400'
                        : (stockMap.get(product.id) ?? 0) <= (product.low_stock_threshold ?? 5)
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}>
                      {stockMap.get(product.id) ?? 0}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[10px]">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      product.is_active ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                    title={product.is_active ? 'Active' : 'Inactive'}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(product)}
                      className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors"
                    >
                      Edit
                    </button>
                    {product.is_stock_tracked && (
                      <button
                        onClick={() => onAdjustStock({
                          id: product.id,
                          name: product.name,
                          stock: stockMap.get(product.id) ?? null,
                        })}
                        className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
                      >
                        Stock
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
