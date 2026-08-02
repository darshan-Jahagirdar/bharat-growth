import { formatINR } from '@/lib/types/database';
import type { BillingState } from '@/lib/billing/useBillingStore';

interface LineItemsGridProps {
  state: BillingState;
  isComposition: boolean;
  onSetActiveLine: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onIncrementQuantity: (index: number) => void;
  onDecrementQuantity: (index: number) => void;
  onRemoveLineItem: (index: number) => void;
}

export function LineItemsGrid({
  state,
  isComposition,
  onSetActiveLine,
  onUpdateQuantity,
  onIncrementQuantity,
  onDecrementQuantity,
  onRemoveLineItem,
}: LineItemsGridProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-8 min-h-[32px] bg-gray-900 border-b border-gray-800 flex items-center px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <span className="w-7 text-center">#</span>
        <span className="flex-1 min-w-0">Item Name</span>
        <span className="w-20 text-center">HSN</span>
        <span className="w-16 text-center">Qty</span>
        <span className="w-20 text-right">Rate</span>
        {!isComposition && <span className="w-12 text-center">Tax%</span>}
        {!isComposition && <span className="w-20 text-right">Tax</span>}
        <span className="w-24 text-right pr-1">Total</span>
        <span className="w-7"></span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {state.lineItems.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-700 text-sm">
            Press <kbd className="bg-gray-800 px-1.5 py-0.5 rounded mx-1 text-xs">F3</kbd> to add items
            or scan a barcode
          </div>
        )}

        {state.lineItems.map((item, index) => {
          const computed = state.totals.lineItems[index];
          const isActive = index === state.activeLineIndex;
          const taxTotal = computed
            ? computed.cgstPaise + computed.sgstPaise + computed.igstPaise
            : 0;

          return (
            <div
              key={item.id}
              onClick={() => onSetActiveLine(index)}
              className={`h-10 flex items-center px-3 text-sm border-b border-gray-800/50 cursor-pointer
                transition-colors duration-75
                ${isActive
                  ? 'bg-orange-950/30 border-l-2 border-l-orange-500'
                  : 'hover:bg-gray-900/50 border-l-2 border-l-transparent'
                }`}
            >
              <span className="w-7 text-center text-gray-600 text-xs">{index + 1}</span>
              <span className="flex-1 min-w-0 truncate text-white font-medium">
                {item.productName}
              </span>
              <span className="w-20 text-center text-gray-500 text-xs font-mono">
                {item.hsnCode}
              </span>
              <span className="w-16 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDecrementQuantity(index);
                    }}
                    className="text-gray-600 hover:text-white text-xs w-4"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(event) => onUpdateQuantity(index, parseFloat(event.target.value) || 1)}
                    className="w-8 bg-transparent text-center text-white text-sm
                               focus:outline-none focus:bg-gray-800 rounded
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onIncrementQuantity(index);
                    }}
                    className="text-gray-600 hover:text-white text-xs w-4"
                  >
                    +
                  </button>
                </div>
              </span>
              <span className="w-20 text-right text-gray-300 font-mono text-xs">
                {formatINR(item.unitPricePaise)}
              </span>
              {!isComposition && (
                <span className="w-12 text-center text-gray-500 text-xs">
                  {item.gstRatePercent}%
                </span>
              )}
              {!isComposition && (
                <span className="w-20 text-right text-gray-500 font-mono text-xs">
                  {formatINR(taxTotal)}
                </span>
              )}
              <span className="w-24 text-right pr-1 text-white font-semibold font-mono text-sm">
                {formatINR(computed?.totalPaise ?? 0)}
              </span>
              <span className="w-7 text-center">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveLineItem(index);
                  }}
                  className="text-gray-700 hover:text-red-400 text-xs"
                >
                  x
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
