import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import Image from 'next/image';
import { formatINR } from '@/lib/types/database';
import type { SelectedCustomer } from '@/lib/billing/useBillingStore';
import { CustomerSearchPicker } from './CustomerSearchPicker';

interface CustomerBarProps {
  customerSearchRef: RefObject<HTMLInputElement | null>;
  customerPhotoRef: RefObject<HTMLInputElement | null>;
  query: string;
  showDropdown: boolean;
  customers: SelectedCustomer[];
  selectedCustomer: SelectedCustomer | null;
  showGstinInput: boolean;
  gstinDraft: string;
  onQueryChange: (query: string) => void;
  onShowDropdownChange: (show: boolean) => void;
  onSelectCustomer: (customer: SelectedCustomer) => void;
  onOpenCreateCustomer: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShowGstinInput: () => void;
  onGstinDraftChange: (gstin: string) => void;
  onCommitGstin: () => void;
  onCancelGstin: () => void;
  onOpenRepayment: () => void;
  onClearCustomer: () => void;
}

export function CustomerBar({
  customerSearchRef,
  customerPhotoRef,
  query,
  showDropdown,
  customers,
  selectedCustomer,
  showGstinInput,
  gstinDraft,
  onQueryChange,
  onShowDropdownChange,
  onSelectCustomer,
  onOpenCreateCustomer,
  onPhotoChange,
  onShowGstinInput,
  onGstinDraftChange,
  onCommitGstin,
  onCancelGstin,
  onOpenRepayment,
  onClearCustomer,
}: CustomerBarProps) {
  const handleGstinKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onCommitGstin();
    if (event.key === 'Escape') onCancelGstin();
  };

  return (
    <div className="h-[52px] min-h-[52px] bg-gray-900/50 border-b border-gray-800 flex items-center px-4 gap-4">
      <CustomerSearchPicker
        customerSearchRef={customerSearchRef}
        query={query}
        showDropdown={showDropdown}
        customers={customers}
        onQueryChange={onQueryChange}
        onShowDropdownChange={onShowDropdownChange}
        onSelectCustomer={onSelectCustomer}
        onOpenCreateCustomer={onOpenCreateCustomer}
      />

      {selectedCustomer && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Upload customer photo"
            className="relative w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden
                       flex-shrink-0 flex items-center justify-center cursor-pointer
                       hover:border-orange-500 transition-colors"
            title="Click to upload photo (optional)"
            onClick={() => customerPhotoRef.current?.click()}
          >
            {selectedCustomer.photoUrl ? (
              <Image src={selectedCustomer.photoUrl} alt="" fill sizes="32px" unoptimized className="object-cover" />
            ) : (
              <span className="text-gray-500 text-xs font-bold">
                {(selectedCustomer.name ?? selectedCustomer.phoneNumber)
                  .split(' ')
                  .map((word) => word.charAt(0))
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </button>
          <input
            ref={customerPhotoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPhotoChange}
          />

          <div className="text-sm">
            <span className="text-white font-medium">{selectedCustomer.name}</span>
            <span className="text-gray-500 text-xs ml-2">{selectedCustomer.phoneNumber}</span>
            {selectedCustomer.gstin && (
              <span className="text-blue-400 text-xs ml-2 font-mono">{selectedCustomer.gstin}</span>
            )}
          </div>

          {!showGstinInput ? (
            <button
              onClick={onShowGstinInput}
              className="px-2 py-0.5 text-[10px] font-semibold rounded border
                         border-blue-800 text-blue-400 bg-blue-900/30
                         hover:bg-blue-800/50 transition-colors"
            >
              {selectedCustomer.gstin ? 'Edit GSTIN' : 'B2B'}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                maxLength={15}
                placeholder="15-digit GSTIN"
                value={gstinDraft}
                onChange={(event) => onGstinDraftChange(event.target.value.toUpperCase())}
                onKeyDown={handleGstinKeyDown}
                className="w-[140px] px-2 py-0.5 text-xs font-mono rounded
                           bg-gray-800 border border-blue-700 text-white
                           placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={onCommitGstin}
                className="text-emerald-400 text-xs hover:text-emerald-300"
              >
                ✓
              </button>
              <button
                onClick={onCancelGstin}
                className="text-gray-500 text-xs hover:text-red-400"
              >
                ✕
              </button>
            </div>
          )}

          <div className="bg-emerald-900/50 border border-emerald-800 rounded px-2.5 py-1">
            <span className="text-emerald-400 text-xs font-semibold">
              {selectedCustomer.loyaltyPoints} pts
            </span>
          </div>

          {selectedCustomer.creditBalancePaise > 0 && (
            <>
              <div className="bg-red-900/50 border border-red-800 rounded px-2.5 py-1">
                <span className="text-red-400 text-xs font-semibold">
                  {formatINR(selectedCustomer.creditBalancePaise)} due
                </span>
              </div>
              <button
                onClick={onOpenRepayment}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-yellow-900/50
                           border border-yellow-800 text-yellow-400
                           hover:bg-yellow-800/50 transition-colors"
              >
                Settle Udhaar
              </button>
            </>
          )}

          <button
            onClick={onClearCustomer}
            className="text-gray-600 hover:text-red-400 text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {!selectedCustomer && (
        <span className="text-gray-600 text-xs">Walk-in customer</span>
      )}
    </div>
  );
}
