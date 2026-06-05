-- =============================================================================
-- Migration 016: Product Images Storage Bucket
-- Creates a public bucket for product photos with tenant-isolated RLS
-- =============================================================================

-- ── Create the public bucket ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                                   -- publicly readable
  5242880,                                -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies on storage.objects ──

-- 1. PUBLIC READ: Anyone (anon) can view product images
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- 2. AUTHENTICATED INSERT: Shop owners can upload into their own shop_id folder
--    File path must start with their shop_id: {shop_id}/filename.ext
CREATE POLICY "Shop owners upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (SELECT get_current_shop_id()::text)
);

-- 3. AUTHENTICATED UPDATE: Shop owners can overwrite their own images
CREATE POLICY "Shop owners update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (SELECT get_current_shop_id()::text)
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (SELECT get_current_shop_id()::text)
);

-- 4. AUTHENTICATED DELETE: Shop owners can delete their own images
CREATE POLICY "Shop owners delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = (SELECT get_current_shop_id()::text)
);
