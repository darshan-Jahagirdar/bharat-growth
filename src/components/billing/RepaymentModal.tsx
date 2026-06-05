'use client';

// =============================================================================
// BharatGrowth — Repayment (Settle Udhaar) Modal
// Quick credit repayment flow — defaults to full balance, optional notes
// =============================================================================

import { useState } from 'react';
import { formatINR } from '@/lib/types/database';

interface RepaymentModalProps {
  isOpen: boolean;
  customerName: string;
  creditBalancePaise: number;
  onConfirm: (amountPaise: number, notes: string) => void;
  onCancel: () => void;
}

export function RepaymentModal({
  isOpen,
  customerName,
  creditBalancePaise,
  onConfirm,
  onCancel,
}: RepaymentModalProps) {
  const fullBalanceRupees = (creditBalancePaise / 100).toFixed(2);
  const [amountStr, setAmountStr] = useState(fullBalanceRupees);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with new balance
  if (isOpen && amountStr === '0.00' && creditBalancePaise > 0) {
    setAmountStr(fullBalanceRupees);
  }

  if (!isOpen) return null;

  function handleConfirm() {
    const rupees = parseFloat(amountStr);
    if (isNaN(rupees) || rupees <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    const paise = Math.round(rupees * 100);
    if (paise > creditBalancePaise) {
      setError(`Cannot exceed outstanding balance of ${formatINR(creditBalancePaise)}`);
      return;
    }
    setError(null);
    onConfirm(paise, notes);
    // Reset for next use
    setAmountStr('0.00');
    setNotes('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-200 mb-1">Settle Udhaar</h3>
        <p className="text-xs text-gray-500 mb-4">
          {customerName} owes{' '}
          <span className="text-red-400 font-semibold">{formatINR(creditBalancePaise)}</span>
        </p>

        {/* Amount */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Repayment Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountStr}
            onChange={(e) => { setAmountStr(e.target.value); setError(null); }}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-lg text-white font-mono focus:border-orange-500 focus:outline-none
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                       [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Quick amount buttons */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setAmountStr(fullBalanceRupees)}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700
                       rounded text-gray-400 transition-colors"
          >
            Full ({formatINR(creditBalancePaise)})
          </button>
          {creditBalancePaise >= 200 && (
            <button
              type="button"
              onClick={() => setAmountStr((creditBalancePaise / 200).toFixed(2))}
              className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700
                         rounded text-gray-400 transition-colors"
            >
              Half ({formatINR(Math.floor(creditBalancePaise / 2))})
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Cash received, UPI transfer"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-sm text-gray-100 focus:border-orange-500 focus:outline-none
                       placeholder-gray-600"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-xs text-red-400">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white
                       text-sm font-semibold rounded-lg transition-colors"
          >
            Confirm Payment
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                       text-sm rounded-lg transition-colors border border-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
