'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { extFromUrl, uploadProductImage } from '@/lib/supabase/storage';
import type { Product } from '@/lib/types/database';
import {
  EMPTY_PRODUCT_FORM,
  productToForm,
  rupeesToPaise,
  type CampaignTag,
  type ProductForm,
} from './productForm';
import type { ProductsDataController } from './useProductsData';

interface UseProductEditorOptions {
  fetchProducts: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setTags: Dispatch<SetStateAction<CampaignTag[]>>;
  shopId: string;
  supabase: ProductsDataController['supabase'];
}

export function useProductEditor({
  fetchProducts,
  setError,
  setTags,
  shopId,
  supabase,
}: UseProductEditorOptions) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timeout);
    }
  }, [success]);

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      const { data, error: tagError } = await supabase
        .from('tags')
        .upsert({ shop_id: shopId, name }, { onConflict: 'shop_id,name' })
        .select('id, name')
        .single();

      if (tagError || !data) {
        setError(`Failed to create tag: ${tagError?.message ?? 'unknown error'}`);
        return;
      }

      setTags((previous) =>
        previous.some((tag) => tag.id === data.id)
          ? previous
          : [...previous, data as CampaignTag].sort((a, b) => a.name.localeCompare(b.name))
      );
      setField('tag_id', data.id);
      setShowNewTagInput(false);
      setNewTagName('');
    } finally {
      setCreatingTag(false);
    }
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

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

  function handleAddNew() {
    setForm(EMPTY_PRODUCT_FORM);
    setEditingId(null);
    setExistingImageUrl(null);
    clearImage();
    setShowForm(true);
    setError(null);
  }

  function handleEdit(product: Product) {
    setForm(productToForm(product));
    setEditingId(product.id);
    setExistingImageUrl(product.image_url);
    clearImage();
    setShowForm(true);
    setError(null);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
    clearImage();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (!form.name.trim()) throw new Error('Product name is required.');
      if (!form.hsn_code.trim()) throw new Error('HSN code is required.');
      if (!form.selling_price_paise) throw new Error('Selling price is required.');

      const sellingPaise = rupeesToPaise(form.selling_price_paise);
      const costPaise = rupeesToPaise(form.unit_price_paise);
      if (sellingPaise <= 0) throw new Error('Selling price must be greater than 0.');

      let productId = editingId;

      if (!productId) {
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            shop_id: shopId,
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            hsn_code: form.hsn_code.trim(),
            category: form.category.trim() || null,
            tag_id: form.tag_id,
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

        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
        productId = newProduct.id;
      } else {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            hsn_code: form.hsn_code.trim(),
            category: form.category.trim() || null,
            tag_id: form.tag_id,
            unit: form.unit,
            unit_price_paise: costPaise,
            selling_price_paise: sellingPaise,
            gst_rate_percent: form.gst_rate_percent,
            barcode: form.barcode.trim() || null,
            is_active: form.is_active,
            is_stock_tracked: form.is_stock_tracked,
          })
          .eq('id', productId)
          .eq('shop_id', shopId);

        if (updateError) throw new Error(`Update failed: ${updateError.message}`);
      }

      let imageUrl = existingImageUrl;
      if (imageFile && productId) {
        setUploading(true);
        try {
          const result = await uploadProductImage(imageFile, shopId, productId);
          imageUrl = result.publicUrl;
          await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', productId)
            .eq('shop_id', shopId);
        } finally {
          setUploading(false);
        }
      }

      setSuccess(editingId ? 'Product updated!' : 'Product added!');
      setShowForm(false);
      setEditingId(null);
      clearImage();
      await fetchProducts();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveImage() {
    if (!editingId || !existingImageUrl) return;

    try {
      const extension = extFromUrl(existingImageUrl);
      const path = `${shopId}/${editingId}.${extension}`;
      await supabase.storage.from('product-images').remove([path]);
      await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', editingId)
        .eq('shop_id', shopId);

      setExistingImageUrl(null);
      setSuccess('Image removed.');
      await fetchProducts();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to remove image');
    }
  }

  return {
    clearImage,
    creatingTag,
    editingId,
    existingImageUrl,
    fileInputRef,
    form,
    handleAddNew,
    handleCancel,
    handleCreateTag,
    handleEdit,
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
    showForm,
    showNewTagInput,
    success,
    uploading,
  };
}

export type ProductEditorController = ReturnType<typeof useProductEditor>;
