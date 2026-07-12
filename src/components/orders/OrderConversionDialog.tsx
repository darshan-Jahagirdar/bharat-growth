import { AlertCircle, ArrowRightLeft, Check, X } from 'lucide-react';
import {
  PAYMENT_MODES,
  type OrderConversionTarget,
} from '@/lib/orders/orderPresentation';

interface OrderConversionDialogProps {
  target: OrderConversionTarget | null;
  paymentMode: string;
  converting: boolean;
  onPaymentModeChange: (paymentMode: string) => void;
  onClose: () => void;
  onConvert: () => void;
}

export function OrderConversionDialog({
  target,
  paymentMode,
  converting,
  onPaymentModeChange,
  onClose,
  onConvert,
}: OrderConversionDialogProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                target.type === 'so'
                  ? 'bg-emerald-500/15'
                  : 'bg-violet-500/15'
              }`}
            >
              <ArrowRightLeft
                className={`w-5 h-5 ${
                  target.type === 'so'
                    ? 'text-emerald-400'
                    : 'text-violet-400'
                }`}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200">
                {target.type === 'so'
                  ? 'Convert to Invoice'
                  : 'Receive Items'}
              </h3>
              <p className="text-xs text-gray-500">{target.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {target.type === 'so' && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-400 mb-2.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onPaymentModeChange(mode.value)}
                  className={`
                    px-4 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200
                    ${paymentMode === mode.value
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800/50 text-gray-400 border-white/5 hover:border-white/10 hover:text-gray-300'
                    }
                  `}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {paymentMode === 'credit' && (
              <p className="mt-2 text-[11px] text-amber-400/80 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Amount will be added to customer&apos;s udhaar balance
              </p>
            )}
          </div>
        )}

        {target.type === 'po' && (
          <div className="mb-5 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
            <p className="text-xs text-gray-400">
              This will create a purchase bill, stock-in all items to
              inventory, and mark the PO as fulfilled. This action cannot
              be undone.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={converting}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                       text-gray-400 border border-white/5 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConvert}
            disabled={converting}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
              transition-all duration-200 disabled:opacity-50
              ${target.type === 'so'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-violet-500 hover:bg-violet-600 text-white'
              }
            `}
          >
            {converting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {target.type === 'so'
                  ? 'Create Invoice'
                  : 'Receive & Stock In'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
