// =============================================================================
// BharatGrowth — Product Image Upload Utility
// Uploads to Supabase Storage `product-images` bucket
// Path convention: {shop_id}/{product_id}.{ext}
// =============================================================================

import { createClient } from './client';

const BUCKET = 'product-images';

/** Accepted image MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Max file size: 5 MB */
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Get file extension from MIME type */
function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'jpg';
  }
}

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload a product image to Supabase Storage.
 *
 * @param file      - The File object from <input type="file">
 * @param shopId    - Current shop's UUID
 * @param productId - Product UUID (used as filename for easy overwrite)
 * @returns         - Public URL of the uploaded image, or throws on error
 */
export async function uploadProductImage(
  file: File,
  shopId: string,
  productId: string
): Promise<UploadResult> {
  // ── Validate ──
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 5 MB.`);
  }

  const ext = extFromMime(file.type);
  const path = `${shopId}/${productId}.${ext}`;

  const supabase = createClient();

  // ── Upload (upsert to allow re-upload / overwrite) ──
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // ── Get public URL ──
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    publicUrl: data.publicUrl,
    path,
  };
}

/**
 * Delete a product image from Supabase Storage.
 *
 * @param shopId    - Current shop's UUID
 * @param productId - Product UUID
 * @param ext       - File extension (default: jpg)
 */
export async function deleteProductImage(
  shopId: string,
  productId: string,
  ext: string = 'jpg'
): Promise<void> {
  const supabase = createClient();
  const path = `${shopId}/${productId}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Extract the extension from an existing image URL (for deletion).
 */
export function extFromUrl(url: string): string {
  const match = url.match(/\.(\w+)(?:\?|$)/);
  return match?.[1] ?? 'jpg';
}
