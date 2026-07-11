'use client';

// =============================================================================
// BharatGrowth — Adjust Stock Modal (Phase 26)
// Stock In / Stock Out toggle with quantity, reason, and adjust_stock RPC call
// =============================================================================

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  productId: string;
  productName: string;
  currentStock: number | null;
  onSuccess: () => void;
}

const REASONS_IN = ['Purchase', 'Return from Customer', 'Opening Stock', 'Found in Audit', 'Other'];
const REASONS_OUT = ['Damage', 'Theft', 'Expired', 'Audit Correction', 'Other'];

export default function AdjustStockModal({
  isOpen,
  onClose,
  shopId,
  productId,
  productName,
  currentStock,
  onSuccess,
}: AdjustStockModalProps) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Purchase');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reasons = direction === 'in' ? REASONS_IN : REASONS_OUT;
  const movementType = direction === 'in' ? 'purchase' : 'adjustment';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numQty = parseFloat(qty);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    setSaving(true);

    const change = direction === 'in' ? numQty : -numQty;
    const supabase = createClient();

    const { error: rpcErr } = await supabase.rpc('adjust_stock', {
      p_shop_id: shopId,
      p_product_id: productId,
      p_quantity_change: change,
      p_movement_type: movementType,
      p_notes: `${reason}: ${direction === 'in' ? '+' : '-'}${numQty}`,
      p_reference_id: null,
      p_reference_type: 'manual',
      p_allow_negative: false,
    });

    setSaving(false);

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    // Reset & close
    setQty('');
    setReason(direction === 'in' ? 'Purchase' : 'Damage');
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800/60 border-b border-gray-700 px-6 py-4">
          <h2 className="text-sm font-bold text-white">Adjust Stock</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{productName}</p>
          {currentStock !== null && (
            <p className="text-xs text-gray-500 mt-1">
              Current Stock: <span className="text-gray-300 font-mono font-semibold">{currentStock}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Direction Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setDirection('in'); setReason('Purchase'); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors
                ${direction === 'in'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                }`}
            >
              Stock In (+)
            </button>
            <button
              type="button"
              onClick={() => { setDirection('out'); setReason('Damage'); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors
                ${direction === 'out'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                }`}
            >
              Stock Out (-)
            </button>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
              placeholder="e.g. 10"
              autoFocus
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                         text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-800 rounded-lg text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors
                ${direction === 'in'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-red-600 hover:bg-red-500'
                } disabled:opacity-50`}
            >
              {saving ? 'Saving...' : direction === 'in' ? 'Add Stock' : 'Remove Stock'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
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
