import { Upload } from 'lucide-react';

interface ProductsHeaderProps {
  onAddProduct: () => void;
  onBulkUpload: () => void;
  productCount: number;
}

export function ProductsHeader({
  onAddProduct,
  onBulkUpload,
  productCount,
}: ProductsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-lg font-bold text-gray-200">Product Catalog</h1>
        <p className="text-xs text-gray-500">
          {productCount} product{productCount !== 1 ? 's' : ''} total
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onBulkUpload}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm
                     font-medium rounded-lg transition-colors border border-gray-700
                     flex items-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Bulk Upload (CSV)
        </button>
        <button
          onClick={onAddProduct}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm
                     font-semibold rounded-lg transition-colors"
        >
          + Add Product
        </button>
      </div>
    </div>
  );
}
