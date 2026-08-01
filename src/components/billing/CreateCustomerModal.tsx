'use client';

// =============================================================================
// BharatGrowth — Create New Customer Modal
// Quick inline customer creation from the billing screen
// Optional photo upload via clickable avatar
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  WHATSAPP_CONSENT_HELPER,
  WHATSAPP_CONSENT_LABEL,
} from '@/lib/billing/customerConsentCopy';

interface CreateCustomerModalProps {
  isOpen: boolean;
  prefillPhone: string;
  onSave: (name: string, phone: string, photoFile: File | null, marketingConsent: boolean) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function CreateCustomerModal({
  isOpen,
  prefillPhone,
  onSave,
  onCancel,
  isSaving,
}: CreateCustomerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setPhone(prefillPhone);
      setPhotoFile(null);
      setPhotoPreview(null);
      setMarketingConsent(false);
      setError(null);
    }
  }, [isOpen, prefillPhone]);

  if (!isOpen) return null;

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim().replace(/\s/g, '');

    if (!trimmedName) {
      setError('Customer name is required.');
      return;
    }
    if (!/^\+?\d{10,13}$/.test(trimmedPhone)) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }

    // Normalize to +91 format
    let normalizedPhone = trimmedPhone;
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+91' + normalizedPhone.replace(/^91/, '');
    }

    onSave(trimmedName, normalizedPhone, photoFile, marketingConsent);
  }

  function handleClose() {
    onCancel();
  }

  // Initials from typed name
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close customer dialog"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-labelledby="create-customer-title" className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 id="create-customer-title" className="text-base font-bold text-gray-200 mb-4">New Customer</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar — click to upload photo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Add customer photo"
              className="relative w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed border-gray-600
                         overflow-hidden flex-shrink-0 flex items-center justify-center
                         cursor-pointer hover:border-orange-500 transition-colors"
              title="Click to add photo (optional)"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <Image src={photoPreview} alt="Preview" fill sizes="64px" unoptimized className="object-cover" />
              ) : (
                <span className="text-gray-500 text-lg font-bold">{initials}</span>
              )}
            </button>
            <div className="text-xs text-gray-500">
              <div>Click circle to add photo</div>
              <div className="text-gray-600">(optional)</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Rajesh Sharma"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">+91</span>
              <input
                type="text"
                value={phone.replace(/^\+91/, '')}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                           text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Marketing consent (DPDP — explicit, default unchecked) */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 accent-orange-500"
            />
            <span className="text-xs text-gray-400">
              {WHATSAPP_CONSENT_LABEL}
              <span className="block text-gray-600">{WHATSAPP_CONSENT_HELPER}</span>
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50
                         text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Customer'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                         text-sm rounded-lg transition-colors border border-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
