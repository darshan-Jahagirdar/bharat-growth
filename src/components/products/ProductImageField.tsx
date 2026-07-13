import Image from 'next/image';
import type { ChangeEventHandler, RefObject } from 'react';

interface ProductImageFieldProps {
  clearImage: () => void;
  existingImageUrl: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  formName: string;
  handleImageSelect: ChangeEventHandler<HTMLInputElement>;
  handleRemoveImage: () => Promise<void>;
  imageFile: File | null;
  imagePreview: string | null;
  uploading: boolean;
}

export function ProductImageField({
  clearImage,
  existingImageUrl,
  fileInputRef,
  formName,
  handleImageSelect,
  handleRemoveImage,
  imageFile,
  imagePreview,
  uploading,
}: ProductImageFieldProps) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-2">
        Product Image (JPG, PNG, or WebP — max 5 MB)
      </label>
      <div className="flex items-start gap-4">
        <div className="relative w-28 h-28 rounded-lg border border-gray-700 bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt="Preview"
              fill
              sizes="112px"
              unoptimized
              className="object-cover"
            />
          ) : existingImageUrl ? (
            <Image
              src={existingImageUrl}
              alt="Current"
              fill
              sizes="112px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <span className="text-gray-600 text-3xl">
              {formName ? formName.charAt(0).toUpperCase() : '?'}
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
            <p className="text-xs text-orange-400 animate-pulse">Uploading image...</p>
          )}
        </div>
      </div>
    </div>
  );
}
