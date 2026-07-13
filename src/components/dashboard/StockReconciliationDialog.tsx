import type { NegativeStockProduct } from '@/lib/dashboard/dashboardQueries';

interface StockReconciliationDialogProps {
  onClose: () => void;
  onQuantityChange: (value: string) => void;
  onResolve: () => void;
  quantity: string;
  resolving: boolean;
  target: NegativeStockProduct | null;
}

export function StockReconciliationDialog({
  onClose,
  onQuantityChange,
  onResolve,
  quantity,
  resolving,
  target,
}: StockReconciliationDialogProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-sm font-bold text-white mb-1">Log Missing Delivery</h3>
        <p className="text-xs text-gray-400 mb-1">{target.name}</p>
        <p className="text-xs text-red-400 font-mono mb-4">
          Current stock: {target.quantity_in_stock} {target.unit}
        </p>
        <label className="block text-xs text-gray-500 mb-1">Actual quantity received from supplier</label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          value={quantity}
          onChange={(event) => onQuantityChange(event.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                     text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none mb-4"
          placeholder="e.g. 20"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            disabled={resolving || !quantity || parseFloat(quantity) <= 0}
            onClick={onResolve}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white
                       hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {resolving ? 'Saving...' : 'Resolve'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                       text-sm rounded-lg transition-colors border border-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
