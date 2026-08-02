import { formatINR } from '@/lib/types/database';
import type { PurchaseBillSaveController } from '@/lib/purchases/usePurchaseBillSave';

interface PurchaseBillFooterProps {
  grandTotal: number;
  itemCount: number;
  save: PurchaseBillSaveController;
}

export function PurchaseBillFooter({
  grandTotal,
  itemCount,
  save,
}: PurchaseBillFooterProps) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <div className="text-sm text-gray-500">
        {itemCount} item{itemCount !== 1 ? 's' : ''} &middot;{' '}
        <span className="text-white font-semibold text-base">
          {formatINR(grandTotal)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save.handleClear}
          className="px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10
                     hover:bg-white/5 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={save.handleSaveDraftPO}
          disabled={save.isCreatingPO || save.isSaving || itemCount === 0}
          className="px-5 py-2.5 rounded-lg text-sm font-medium
                     bg-violet-900/40 text-violet-300 border border-violet-700/50
                     hover:bg-violet-900/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {save.isCreatingPO ? (
            <>
              <div className="w-4 h-4 border-2 border-violet-300/40 border-t-violet-300 rounded-full animate-spin" />
              Creating PO...
            </>
          ) : (
            <>Save as PO</>
          )}
        </button>
        <button
          onClick={save.handleSave}
          disabled={save.isSaving || save.isCreatingPO || itemCount === 0}
          className="px-6 py-2.5 rounded-lg text-sm font-bold bg-orange-500 text-white
                     hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {save.isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>Save Bill (F10)</>
          )}
        </button>
      </div>
    </div>
  );
}
