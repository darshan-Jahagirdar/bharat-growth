'use client';

// =============================================================================
// BharatGrowth — Product Management Page
// List, add, edit products with image upload via Supabase Storage
// Desktop-optimized, keyboard-friendly
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProductImage, extFromUrl } from '@/lib/supabase/storage';
import { formatINR } from '@/lib/types/database';
import type {
  Product,
  GstRatePercent,
  ProductUnit,
} from '@/lib/types/database';
import TopNav from '@/components/layout/TopNav';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import BulkUploadModal from '@/components/dashboard/BulkUploadModal';
import AdjustStockModal from '@/components/dashboard/AdjustStockModal';
import { Upload } from 'lucide-react';

// ── Constants ──

const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28];
const UNITS: ProductUnit[] = [
  'piece', 'kg', 'g', 'litre', 'ml', 'metre', 'set', 'pair', 'box',
];

// ── Empty form state ──

interface ProductForm {
  name: string;
  sku: string;
  hsn_code: string;
  category: string;
  unit: ProductUnit;
  unit_price_paise: string;   // stored as rupee string for easy editing
  selling_price_paise: string;
  gst_rate_percent: GstRatePercent;
  barcode: string;
  is_active: boolean;
  is_stock_tracked: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  hsn_code: '',
  category: '',
  unit: 'piece',
  unit_price_paise: '',
  selling_price_paise: '',
  gst_rate_percent: 18,
  barcode: '',
  is_active: true,
  is_stock_tracked: false,
};

// ── Helpers ──

function rupeesToPaise(rupees: string): number {
  const val = parseFloat(rupees);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

function paiseToRupeeStr(paise: number): string {
  return (paise / 100).toFixed(2);
}

// =============================================================================

export default function ProductsPage() {
  const [SHOP_ID, setShopId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  // ── Image state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Search ──
  const [search, setSearch] = useState('');

  // ── Bulk upload modal ──
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // ── Adjust stock modal ──
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; name: string; stock: number | null } | null>(null);

  // ── Stock data (product_id → quantity) ──
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());

  const supabase = createClient();

  // ── Resolve shop from authenticated user ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) setShopId(ctx.shopId);
      });
    });
  }, [supabase]);

  // ── Fetch products ──
  const fetchProducts = useCallback(async () => {
    if (!SHOP_ID) return;
    const { data, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('name');

    if (fetchErr) {
      setError(`Failed to load products: ${fetchErr.message}`);
    } else {
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
  }, [supabase, SHOP_ID]);

  // ── Fetch inventory stock levels ──
  const fetchStock = useCallback(async () => {
    if (!SHOP_ID) return;
    const { data } = await supabase
      .from('inventory')
      .select('product_id, quantity_in_stock')
      .eq('shop_id', SHOP_ID);

    if (data) {
      const map = new Map<string, number>();
      for (const row of data) {
        map.set(row.product_id, Number(row.quantity_in_stock));
      }
      setStockMap(map);
    }
  }, [supabase, SHOP_ID]);

  useEffect(() => {
    fetchProducts();
    fetchStock();
  }, [fetchProducts, fetchStock]);

  // ── Clear flash messages after 4s ──
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Image file handler ──
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate client-side
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Open form for new product ──
  function handleAddNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setExistingImageUrl(null);
    clearImage();
    setShowForm(true);
    setError(null);
  }

  // ── Open form for editing ──
  function handleEdit(product: Product) {
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      hsn_code: product.hsn_code,
      category: product.category ?? '',
      unit: product.unit,
      unit_price_paise: paiseToRupeeStr(product.unit_price_paise),
      selling_price_paise: paiseToRupeeStr(product.selling_price_paise),
      gst_rate_percent: product.gst_rate_percent,
      barcode: product.barcode ?? '',
      is_active: product.is_active,
      is_stock_tracked: product.is_stock_tracked ?? false,
    });
    setEditingId(product.id);
    setExistingImageUrl(product.image_url);
    clearImage();
    setShowForm(true);
    setError(null);
  }

  // ── Cancel form ──
  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
    clearImage();
  }

  // ── Submit (create or update) ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate required fields
      if (!form.name.trim()) throw new Error('Product name is required.');
      if (!form.hsn_code.trim()) throw new Error('HSN code is required.');
      if (!form.selling_price_paise) throw new Error('Selling price is required.');

      const sellingPaise = rupeesToPaise(form.selling_price_paise);
      const costPaise = rupeesToPaise(form.unit_price_paise);
      if (sellingPaise <= 0) throw new Error('Selling price must be greater than 0.');

      // ── Determine product ID ──
      let productId = editingId;

      if (!productId) {
        // Creating new product — insert first to get the ID
        const { data: newProduct, error: insertErr } = await supabase
          .from('products')
          .insert({
            shop_id: SHOP_ID,
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            hsn_code: form.hsn_code.trim(),
            category: form.category.trim() || null,
            unit: form.unit,
            unit_price_paise: costPaise,
            selling_price_paise: sellingPaise,
            gst_rate_percent: form.gst_rate_percent,
            barcode: form.barcode.trim() || null,
            is_active: form.is_active,
            is_stock_tracked: form.is_stock_tracked,
            vertical_attrs: {},
            image_url: null,
          })
          .select('id')
          .single();

        if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
        productId = newProduct.id;
      } else {
        // Update existing product fields (except image_url for now)
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            hsn_code: form.hsn_code.trim(),
            category: form.category.trim() || null,
            unit: form.unit,
            unit_price_paise: costPaise,
            selling_price_paise: sellingPaise,
            gst_rate_percent: form.gst_rate_percent,
            barcode: form.barcode.trim() || null,
            is_active: form.is_active,
            is_stock_tracked: form.is_stock_tracked,
          })
          .eq('id', productId)
          .eq('shop_id', SHOP_ID);

        if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
      }

      // ── Upload image if selected ──
      let imageUrl = existingImageUrl;
      if (imageFile && productId) {
        setUploading(true);
        try {
          const result = await uploadProductImage(imageFile, SHOP_ID, productId);
          imageUrl = result.publicUrl;

          // Save image_url to product
          await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', productId)
            .eq('shop_id', SHOP_ID);
        } finally {
          setUploading(false);
        }
      }

      setSuccess(editingId ? 'Product updated!' : 'Product added!');
      setShowForm(false);
      setEditingId(null);
      clearImage();
      await fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Remove image from existing product ──
  async function handleRemoveImage() {
    if (!editingId || !existingImageUrl) return;

    try {
      // Try to delete from storage
      const ext = extFromUrl(existingImageUrl);
      const path = `${SHOP_ID}/${editingId}.${ext}`;
      await supabase.storage.from('product-images').remove([path]);

      // Clear image_url in DB
      await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', editingId)
        .eq('shop_id', SHOP_ID);

      setExistingImageUrl(null);
      setSuccess('Image removed.');
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove image');
    }
  }

  // ── Filtered products ──
  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku?.toLowerCase().includes(q) ?? false) ||
      p.hsn_code.includes(q) ||
      (p.barcode?.includes(q) ?? false) ||
      (p.category?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Form field updater ──
  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-gray-200">Product Catalog</h1>
            <p className="text-xs text-gray-500">
              {products.length} product{products.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkUpload(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm
                         font-medium rounded-lg transition-colors border border-gray-700
                         flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              Bulk Upload (CSV)
            </button>
            <button
              onClick={handleAddNew}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm
                         font-semibold rounded-lg transition-colors"
            >
              + Add Product
            </button>
          </div>
        </div>
        {/* ── Flash Messages ── */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 bg-emerald-900/40 border border-emerald-800 rounded-lg text-emerald-300 text-sm">
            {success}
          </div>
        )}

        {/* ── Product Form (Add/Edit) ── */}
        {showForm && (
          <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-base font-bold text-gray-200 mb-4">
              {editingId ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Name + Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                    placeholder="e.g. Apollo Amazer 4G Life 185/65 R15"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                    placeholder="e.g. Tyres, Sweets"
                  />
                </div>
              </div>

              {/* Row 2: HSN + SKU + Barcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    HSN Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.hsn_code}
                    onChange={(e) => setField('hsn_code', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
                    placeholder="e.g. 40111000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setField('sku', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
                    placeholder="e.g. TYR-APO-185"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setField('barcode', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
                    placeholder="Scan or type"
                  />
                </div>
              </div>

              {/* Row 3: Prices + GST + Unit */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_price_paise}
                    onChange={(e) => setField('unit_price_paise', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Selling Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.selling_price_paise}
                    onChange={(e) => setField('selling_price_paise', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">GST Rate</label>
                  <select
                    value={form.gst_rate_percent}
                    onChange={(e) =>
                      setField('gst_rate_percent', Number(e.target.value) as GstRatePercent)
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setField('unit', e.target.value as ProductUnit)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Image Upload */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Product Image (JPG, PNG, or WebP — max 5 MB)
                </label>
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="w-28 h-28 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : existingImageUrl ? (
                      <img
                        src={existingImageUrl}
                        alt="Current"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 text-3xl">
                        {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="block text-sm text-gray-400 file:mr-3 file:py-2 file:px-4
                                 file:rounded-lg file:border-0 file:text-sm file:font-medium
                                 file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700
                                 file:cursor-pointer file:transition-colors"
                    />
                    <div className="flex gap-2">
                      {imageFile && (
                        <button
                          type="button"
                          onClick={clearImage}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                          Remove new image
                        </button>
                      )}
                      {existingImageUrl && !imageFile && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Delete existing image
                        </button>
                      )}
                    </div>
                    {uploading && (
                      <p className="text-xs text-orange-400 animate-pulse">
                        Uploading image...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 5: Active toggle + Track Inventory toggle */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setField('is_active', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors
                                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                    after:bg-white after:rounded-full after:h-4 after:w-4
                                    after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-sm text-gray-400">Active (visible on storefront)</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_stock_tracked}
                      onChange={(e) => setField('is_stock_tracked', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-colors
                                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                    after:bg-white after:rounded-full after:h-4 after:w-4
                                    after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-sm text-gray-400">Track Inventory</span>
                </div>
              </div>

              {/* Submit / Cancel */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50
                             text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Product'
                      : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                             text-sm rounded-lg transition-colors border border-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Search Bar ── */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5
                       text-sm text-gray-100 placeholder-gray-600 focus:border-orange-500 focus:outline-none"
            placeholder="Search by name, SKU, HSN, barcode, or category..."
          />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm mt-3">Loading products...</p>
          </div>
        )}

        {/* ── Product Table ── */}
        {!loading && (
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-600">
                      {search
                        ? 'No products match your search.'
                        : 'No products yet. Click "+ Add Product" to get started.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-600 text-sm font-bold">
                              {p.name.charAt(0)}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Name + category */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-200">{p.name}</div>
                        {p.category && (
                          <div className="text-[11px] text-gray-500">{p.category}</div>
                        )}
                      </td>
                      {/* HSN */}
                      <td className="px-4 py-3 font-mono text-gray-400 hidden md:table-cell">
                        {p.hsn_code}
                      </td>
                      {/* SKU */}
                      <td className="px-4 py-3 font-mono text-gray-500 hidden lg:table-cell">
                        {p.sku ?? '—'}
                      </td>
                      {/* Price */}
                      <td className="px-4 py-3 text-right font-mono text-gray-200">
                        {formatINR(p.selling_price_paise)}
                      </td>
                      {/* GST */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400">
                          {p.gst_rate_percent}%
                        </span>
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {p.is_stock_tracked ? (
                          <span className={`font-mono text-xs font-semibold ${
                            (stockMap.get(p.id) ?? 0) <= 0
                              ? 'text-red-400'
                              : (stockMap.get(p.id) ?? 0) <= (p.low_stock_threshold ?? 5)
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}>
                            {stockMap.get(p.id) ?? 0}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[10px]">--</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            p.is_active ? 'bg-emerald-500' : 'bg-gray-600'
                          }`}
                          title={p.is_active ? 'Active' : 'Inactive'}
                        />
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors"
                          >
                            Edit
                          </button>
                          {p.is_stock_tracked && (
                            <button
                              onClick={() => setAdjustTarget({
                                id: p.id,
                                name: p.name,
                                stock: stockMap.get(p.id) ?? null,
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
        )}

        {/* ���─ Bulk Upload Modal ── */}
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          shopId={SHOP_ID}
          onSuccess={fetchProducts}
        />

        {/* ── Adjust Stock Modal ── */}
        {adjustTarget && (
          <AdjustStockModal
            isOpen={true}
            onClose={() => setAdjustTarget(null)}
            shopId={SHOP_ID}
            productId={adjustTarget.id}
            productName={adjustTarget.name}
            currentStock={adjustTarget.stock}
            onSuccess={() => { fetchStock(); fetchProducts(); }}
          />
        )}
      </div>
    </div>
  );
}
