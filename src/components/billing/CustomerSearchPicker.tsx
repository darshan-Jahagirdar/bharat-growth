import Image from 'next/image';
import type { RefObject } from 'react';
import { formatINR } from '@/lib/types/database';
import type { SelectedCustomer } from '@/lib/billing/useBillingStore';

interface CustomerSearchPickerProps {
  customerSearchRef: RefObject<HTMLInputElement | null>;
  query: string;
  showDropdown: boolean;
  customers: SelectedCustomer[];
  onQueryChange: (query: string) => void;
  onShowDropdownChange: (show: boolean) => void;
  onSelectCustomer: (customer: SelectedCustomer) => void;
  onOpenCreateCustomer: () => void;
  placeholder?: string;
}

export function CustomerSearchPicker({
  customerSearchRef,
  query,
  showDropdown,
  customers,
  onQueryChange,
  onShowDropdownChange,
  onSelectCustomer,
  onOpenCreateCustomer,
  placeholder = 'Phone number or name... (F2)',
}: CustomerSearchPickerProps) {
  return (
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
          placeholder={placeholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                     focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50
                     placeholder-gray-600"
        />
      </div>
      {showDropdown && query.length >= 2 && (
        <div className="absolute top-full left-20 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-56 overflow-y-auto">
          {customers.map((customer) => (
            <button
              type="button"
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
            type="button"
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
  );
}
