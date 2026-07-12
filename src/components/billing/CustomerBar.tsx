import Image from 'next/image';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { formatINR } from '@/lib/types/database';
import type { SelectedCustomer } from '@/lib/billing/useBillingStore';

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
      <div className="relative flex-1 max-w-md">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs w-20">Customer</span>
          <input
            ref={customerSearchRef}
            type="text"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onShowDropdownChange(true);
            }}
            onFocus={() => onShowDropdownChange(true)}
            onBlur={() => setTimeout(() => onShowDropdownChange(false), 200)}
            placeholder="Phone number or name... (F2)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                       focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50
                       placeholder-gray-600"
          />
        </div>
        {showDropdown && query.length >= 2 && (
          <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-56 overflow-y-auto">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onMouseDown={() => onSelectCustomer(customer)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
              >
                <div className="relative w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {customer.photoUrl ? (
                    <Image src={customer.photoUrl} alt="" fill sizes="24px" unoptimized className="object-cover" />
                  ) : (
                    <span className="text-gray-500 text-[10px] font-bold">
                      {(customer.name ?? customer.phoneNumber).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span>
                    <span className="text-white">{customer.name ?? 'Unknown'}</span>
                    <span className="text-gray-500 ml-2">{customer.phoneNumber}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {customer.creditBalancePaise > 0 && (
                      <span className="text-[10px] text-red-400 font-semibold">
                        {formatINR(customer.creditBalancePaise)} due
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{customer.segment}</span>
                  </span>
                </div>
              </button>
            ))}
            <button
              onMouseDown={onOpenCreateCustomer}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-700
                         border-t border-gray-700 flex items-center gap-2 text-orange-400"
            >
              <span className="w-6 h-6 rounded-full bg-orange-900/40 border border-orange-700
                             flex items-center justify-center flex-shrink-0 text-xs">
                +
              </span>
              <span>
                Add new customer{query ? ': ' : ''}
                {query && <span className="text-white font-medium">{query}</span>}
              </span>
            </button>
          </div>
        )}
      </div>

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
