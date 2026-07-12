import { formatINR } from '@/lib/types/database';
import type { BillingState } from '@/lib/billing/useBillingStore';
import { PAYMENT_LABELS } from '@/lib/billing/paymentModes';

interface BillingFooterProps {
  state: BillingState;
  isComposition: boolean;
  validationErrors: string[];
  saveSuccess: string | false;
  lowStockWarning: string | false;
  isSaving: boolean;
  isReserving: boolean;
  onCyclePayment: () => void;
  onClearBill: () => void;
  onReserveSalesOrder: () => void;
  onSaveBill: () => void;
}

export function BillingFooter({
  state,
  isComposition,
  validationErrors,
  saveSuccess,
  lowStockWarning,
  isSaving,
  isReserving,
  onCyclePayment,
  onClearBill,
  onReserveSalesOrder,
  onSaveBill,
}: BillingFooterProps) {
  return (
    <footer className="h-[120px] min-h-[120px] bg-gray-900 border-t border-gray-700">
      {validationErrors.length > 0 && (
        <div className="absolute bottom-[124px] left-4 right-4 bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300">
          {validationErrors.map((error, index) => <div key={index}>{error}</div>)}
        </div>
      )}
      {saveSuccess && (
        <div className="absolute bottom-[124px] left-4 right-4 bg-emerald-950 border border-emerald-800 rounded p-2 text-xs text-emerald-300">
          {saveSuccess}
        </div>
      )}
      {lowStockWarning && (
        <div className="absolute bottom-[124px] left-4 right-4 bg-amber-950 border border-amber-800 rounded p-2 text-xs text-amber-300">
          {lowStockWarning}
        </div>
      )}

      <div className="h-full flex items-center px-4 gap-6">
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-0.5 text-xs max-w-md">
          <div className="flex justify-between text-gray-400">
            <span>Subtotal</span>
            <span className="font-mono">{formatINR(state.totals.subtotalPaise)}</span>
          </div>
          {!isComposition && (
            <>
              <div className="flex justify-between text-gray-400">
                <span>CGST</span>
                <span className="font-mono">{formatINR(state.totals.cgstTotalPaise)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>SGST</span>
                <span className="font-mono">{formatINR(state.totals.sgstTotalPaise)}</span>
              </div>
              {state.totals.igstTotalPaise > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>IGST</span>
                  <span className="font-mono">{formatINR(state.totals.igstTotalPaise)}</span>
                </div>
              )}
            </>
          )}
          {isComposition && (
            <div className="flex justify-between text-yellow-600">
              <span>Tax (Composition)</span>
              <span className="font-mono">Incl.</span>
            </div>
          )}
          {state.totals.discountPaise > 0 && (
            <div className="flex justify-between text-emerald-500">
              <span>Discount</span>
              <span className="font-mono">-{formatINR(state.totals.discountPaise)}</span>
            </div>
          )}
          {state.totals.roundOffPaise !== 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Round Off</span>
              <span className="font-mono">
                {state.totals.roundOffPaise > 0 ? '+' : ''}
                {formatINR(Math.abs(state.totals.roundOffPaise))}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center px-8">
          <span className="text-gray-500 text-[10px] uppercase tracking-widest">Total</span>
          <span className="text-4xl font-bold text-white font-mono tracking-tight">
            {formatINR(state.totals.totalPaise)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCyclePayment}
            className={`px-4 py-3 rounded-lg text-sm font-semibold min-w-[90px] text-center transition-colors
              ${state.paymentMode === 'cash'
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                : state.paymentMode === 'upi'
                ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                : state.paymentMode === 'card'
                ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                : 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'
              }`}
          >
            {PAYMENT_LABELS[state.paymentMode]}
            <div className="text-[9px] opacity-60 mt-0.5">F8 to change</div>
          </button>

          <button
            onClick={onClearBill}
            className="px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm
                       border border-gray-700 transition-colors"
          >
            New Bill
            <div className="text-[9px] text-gray-600 mt-0.5">F4</div>
          </button>

          <button
            onClick={onReserveSalesOrder}
            disabled={state.lineItems.length === 0 || isReserving || isSaving}
            className="px-4 py-3 rounded-lg text-sm font-medium
                       bg-blue-900/40 text-blue-300 border border-blue-700/50
                       hover:bg-blue-900/60 disabled:bg-gray-800
                       disabled:text-gray-600 disabled:border-gray-700 transition-colors"
          >
            {isReserving ? 'Reserving...' : 'Reserve (SO)'}
            <div className="text-[9px] opacity-60 mt-0.5">Sales Order</div>
          </button>

          <button
            onClick={onSaveBill}
            disabled={state.lineItems.length === 0 || isSaving}
            className="px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800
                       disabled:text-gray-600 text-white text-sm font-semibold
                       border border-orange-500 disabled:border-gray-700 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save & Print'}
            <div className="text-[9px] opacity-70 mt-0.5">F5</div>
          </button>
        </div>
      </div>
    </footer>
  );
}
