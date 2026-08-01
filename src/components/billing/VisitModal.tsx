'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchVisitTags,
  logCustomerVisit,
  type VisitTag,
} from '@/lib/billing/billingVisitQueries';
import {
  WHATSAPP_CONSENT_HELPER,
  WHATSAPP_CONSENT_LABEL,
} from '@/lib/billing/customerConsentCopy';
import { useBillingSearch } from '@/lib/billing/useBillingSearch';
import type { SelectedCustomer } from '@/lib/billing/useBillingStore';
import { CustomerSearchPicker } from './CustomerSearchPicker';

interface VisitModalProps {
  isOpen: boolean;
  shopId: string;
  supabaseConfigured: boolean;
  demoMode: boolean;
  onClose: () => void;
}

function normalizeIndianPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export function VisitModal({
  isOpen,
  shopId,
  supabaseConfigured,
  demoMode,
  onClose,
}: VisitModalProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef('');
  const {
    customerQuery,
    setCustomerQuery,
    showCustomerDropdown,
    setShowCustomerDropdown,
    filteredCustomers,
  } = useBillingSearch({ shopId, supabaseConfigured, demoMode });
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [tags, setTags] = useState<VisitTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    requestIdRef.current = crypto.randomUUID();
    setCustomerQuery('');
    setShowCustomerDropdown(false);
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setPhone('');
    setName('');
    setTagId('');
    setMarketingConsent(true);
    setIsSaving(false);
    setError(null);
    setSaved(false);

    const focusFrame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, [isOpen, setCustomerQuery, setShowCustomerDropdown]);

  useEffect(() => {
    if (!isOpen || !shopId || !supabaseConfigured) {
      setTags([]);
      return;
    }

    let cancelled = false;
    fetchVisitTags(shopId)
      .then((nextTags) => {
        if (!cancelled) setTags(nextTags);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Failed to load interest tags.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, shopId, supabaseConfigured]);

  if (!isOpen) return null;

  const handleSelectCustomer = (customer: SelectedCustomer) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.phoneNumber);
    setShowCustomerDropdown(false);
    setIsNewCustomer(false);
    setError(null);
  };

  const handleOpenNewCustomer = () => {
    setPhone(customerQuery.replace(/\D/g, '').slice(-10));
    setName('');
    setSelectedCustomer(null);
    setShowCustomerDropdown(false);
    setIsNewCustomer(true);
    setError(null);
  };

  const handleChangeCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setError(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || saved) return;

    const sourcePhone = selectedCustomer?.phoneNumber ?? phone;
    const normalizedPhone = normalizeIndianPhone(sourcePhone);
    if (!normalizedPhone) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await logCustomerVisit({
        request_id: requestIdRef.current,
        phone_number: normalizedPhone,
        customer_name: (selectedCustomer?.name ?? name).trim() || null,
        tag_id: tagId || null,
        marketing_consent: marketingConsent,
      });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record the visit. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close visit dialog"
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          if (!isSaving) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-dialog-title"
        className="relative w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="visit-dialog-title" className="text-base font-bold text-gray-100">
              Record customer visit
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              For a purchase that was not billed. Adds 1 loyalty point; no amount or items are recorded.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close visit dialog"
            disabled={isSaving}
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {saved ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
              Visit recorded. 1 loyalty point added.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!selectedCustomer && !isNewCustomer && (
              <CustomerSearchPicker
                customerSearchRef={searchRef}
                query={customerQuery}
                showDropdown={showCustomerDropdown}
                customers={filteredCustomers}
                onQueryChange={setCustomerQuery}
                onShowDropdownChange={setShowCustomerDropdown}
                onSelectCustomer={handleSelectCustomer}
                onOpenCreateCustomer={handleOpenNewCustomer}
                placeholder="Phone number or name..."
              />
            )}

            {selectedCustomer && (
              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">
                    {selectedCustomer.name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">{selectedCustomer.phoneNumber}</div>
                </div>
                <button
                  type="button"
                  onClick={handleChangeCustomer}
                  className="text-xs font-medium text-orange-400 hover:text-orange-300"
                >
                  Change
                </button>
              </div>
            )}

            {isNewCustomer && (
              <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">New customer</span>
                  <button
                    type="button"
                    onClick={handleChangeCustomer}
                    className="text-xs font-medium text-orange-400 hover:text-orange-300"
                  >
                    Search existing
                  </button>
                </div>
                <label className="block text-xs text-gray-500">
                  Phone number <span className="text-red-500">*</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-500">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono text-gray-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </label>
                <label className="block text-xs text-gray-500">
                  Name <span className="text-gray-600">(optional)</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                  />
                </label>
              </div>
            )}

            {(selectedCustomer || isNewCustomer) && (
              <>
                <label className="block text-xs text-gray-500">
                  Interest category <span className="text-gray-600">(optional)</span>
                  <select
                    value={tagId}
                    onChange={(event) => setTagId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">No category</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </label>

                <label className="flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(event) => setMarketingConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 accent-orange-500"
                  />
                  <span className="text-xs text-gray-400">
                    {WHATSAPP_CONSENT_LABEL}
                    <span className="block text-gray-600">{WHATSAPP_CONSENT_HELPER}</span>
                  </span>
                </label>
              </>
            )}

            {error && (
              <div role="alert" className="text-xs text-red-400">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isSaving || (!selectedCustomer && !isNewCustomer)}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
              >
                {isSaving ? 'Recording...' : 'Record Visit'}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-400 transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
