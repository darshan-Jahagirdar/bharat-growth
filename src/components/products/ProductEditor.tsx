import type { CampaignTag } from '@/lib/products/productForm';
import type { ProductEditorController } from '@/lib/products/useProductEditor';
import { ProductCommerceFields } from './ProductCommerceFields';
import { ProductIdentityFields } from './ProductIdentityFields';
import { ProductImageField } from './ProductImageField';

interface ProductEditorProps {
  controller: ProductEditorController;
  tags: CampaignTag[];
}

export function ProductEditor({ controller, tags }: ProductEditorProps) {
  const {
    clearImage,
    creatingTag,
    editingId,
    existingImageUrl,
    fileInputRef,
    form,
    handleCancel,
    handleCreateTag,
    handleImageSelect,
    handleRemoveImage,
    handleSubmit,
    imageFile,
    imagePreview,
    newTagName,
    saving,
    setField,
    setNewTagName,
    setShowNewTagInput,
    showNewTagInput,
    uploading,
  } = controller;

  return (
    <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-base font-bold text-gray-200 mb-4">
        {editingId ? 'Edit Product' : 'Add New Product'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ProductIdentityFields
          creatingTag={creatingTag}
          form={form}
          handleCreateTag={handleCreateTag}
          newTagName={newTagName}
          setField={setField}
          setNewTagName={setNewTagName}
          setShowNewTagInput={setShowNewTagInput}
          showNewTagInput={showNewTagInput}
          tags={tags}
        />
        <ProductCommerceFields form={form} setField={setField} />
        <ProductImageField
          clearImage={clearImage}
          existingImageUrl={existingImageUrl}
          fileInputRef={fileInputRef}
          formName={form.name}
          handleImageSelect={handleImageSelect}
          handleRemoveImage={handleRemoveImage}
          imageFile={imageFile}
          imagePreview={imagePreview}
          uploading={uploading}
        />

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setField('is_active', event.target.checked)}
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
                onChange={(event) => setField('is_stock_tracked', event.target.checked)}
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50
                       text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
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
  );
}
