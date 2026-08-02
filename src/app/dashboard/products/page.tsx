'use client';

import { useState } from 'react';
import AdjustStockModal from '@/components/dashboard/AdjustStockModal';
import BulkUploadModal from '@/components/dashboard/BulkUploadModal';
import TopNav from '@/components/layout/TopNav';
import { ProductEditor } from '@/components/products/ProductEditor';
import { ProductsHeader } from '@/components/products/ProductsHeader';
import { ProductsTable } from '@/components/products/ProductsTable';
import { filterProducts, type StockAdjustmentTarget } from '@/lib/products/productForm';
import { useProductEditor } from '@/lib/products/useProductEditor';
import { useProductsData } from '@/lib/products/useProductsData';

export default function ProductsPage() {
  const data = useProductsData();
  const editor = useProductEditor({
    fetchProducts: data.fetchProducts,
    setError: data.setError,
    setTags: data.setTags,
    shopId: data.shopId,
    supabase: data.supabase,
  });
  const [search, setSearch] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockAdjustmentTarget | null>(null);
  const filteredProducts = filterProducts(data.products, search);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-6">
        <ProductsHeader
          onAddProduct={editor.handleAddNew}
          onBulkUpload={() => setShowBulkUpload(true)}
          productCount={data.products.length}
        />

        {data.error && (
          <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-800 rounded-lg text-red-300 text-sm">
            {data.error}
          </div>
        )}
        {editor.success && (
          <div className="mb-4 px-4 py-3 bg-emerald-900/40 border border-emerald-800 rounded-lg text-emerald-300 text-sm">
            {editor.success}
          </div>
        )}

        {editor.showForm && <ProductEditor controller={editor} tags={data.tags} />}

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5
                       text-sm text-gray-100 placeholder-gray-600 focus:border-orange-500 focus:outline-none"
            placeholder="Search by name, SKU, HSN, barcode, or category..."
          />
        </div>

        {data.loading && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm mt-3">Loading products...</p>
          </div>
        )}

        {!data.loading && (
          <ProductsTable
            onAdjustStock={setAdjustTarget}
            onEdit={editor.handleEdit}
            products={filteredProducts}
            search={search}
            stockMap={data.stockMap}
            tags={data.tags}
          />
        )}

        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          shopId={data.shopId}
          onSuccess={data.fetchProducts}
        />

        {adjustTarget && (
          <AdjustStockModal
            isOpen={true}
            onClose={() => setAdjustTarget(null)}
            shopId={data.shopId}
            productId={adjustTarget.id}
            productName={adjustTarget.name}
            currentStock={adjustTarget.stock}
            onSuccess={() => {
              data.fetchStock();
              data.fetchProducts();
            }}
          />
        )}
      </div>
    </div>
  );
}
