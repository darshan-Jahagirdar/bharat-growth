import type { CampaignTag, ProductFieldSetter, ProductForm } from '@/lib/products/productForm';
import { NEW_TAG_SENTINEL } from '@/lib/products/productForm';

interface ProductIdentityFieldsProps {
  creatingTag: boolean;
  form: ProductForm;
  handleCreateTag: () => Promise<void>;
  newTagName: string;
  setField: ProductFieldSetter;
  setNewTagName: (name: string) => void;
  setShowNewTagInput: (show: boolean) => void;
  showNewTagInput: boolean;
  tags: CampaignTag[];
}

export function ProductIdentityFields({
  creatingTag,
  form,
  handleCreateTag,
  newTagName,
  setField,
  setNewTagName,
  setShowNewTagInput,
  showNewTagInput,
  tags,
}: ProductIdentityFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
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
            onChange={(event) => setField('category', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            placeholder="e.g. Tyres, Sweets"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Bring-Back Tag
            <span className="text-gray-600 ml-1">(drives WhatsApp reminders)</span>
          </label>
          <select
            value={form.tag_id ?? ''}
            onChange={(event) => {
              if (event.target.value === NEW_TAG_SENTINEL) {
                setShowNewTagInput(true);
                setNewTagName('');
              } else {
                setField('tag_id', event.target.value || null);
              }
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
          >
            <option value="">— No tag —</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
            <option value={NEW_TAG_SENTINEL}>+ New tag…</option>
          </select>
        </div>
        {showNewTagInput && (
          <div className="md:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">New Tag Name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreateTag();
                  }
                }}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                placeholder="e.g. Tyres, Gift Boxes"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={creatingTag || !newTagName.trim()}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50
                         text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {creatingTag ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewTagInput(false);
                setNewTagName('');
              }}
              className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                         text-sm rounded-lg transition-colors border border-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
