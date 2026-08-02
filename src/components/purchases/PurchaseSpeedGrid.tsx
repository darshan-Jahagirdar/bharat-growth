import { formatINR } from '@/lib/types/database';
import type { PurchaseGridController } from '@/lib/purchases/usePurchaseGrid';

interface PurchaseSpeedGridProps {
  grid: PurchaseGridController;
}

export function PurchaseSpeedGrid({ grid }: PurchaseSpeedGridProps) {
  return (
    <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[40px_1fr_120px_160px_140px_48px] gap-0 px-4 py-3
                      bg-gray-900 border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
        <div>#</div>
        <div>Product</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Cost Price (₹)</div>
        <div className="text-right">Total</div>
        <div />
      </div>

      {grid.rows.map((row, index) => (
        <div
          key={row.id}
          className={`grid grid-cols-[40px_1fr_120px_160px_140px_48px] gap-0 px-4 py-1.5
                      items-center border-b border-white/5 last:border-b-0
                      ${!row.matched && row.productQuery && !row.product
                        ? 'bg-amber-500/10 border-l-2 border-l-amber-500/50'
                        : ''
                      }`}
        >
          <div className="text-xs text-gray-600">{index + 1}</div>

          <div className="relative pr-3">
            <input
              ref={(element) => grid.setCellRef(index, 'product', element)}
              type="text"
              value={row.productQuery}
              onChange={(event) => grid.updateProductQuery(index, event.target.value)}
              onKeyDown={(event) => grid.handleCellKeyDown(event, index, 'product')}
              onBlur={() => {
                setTimeout(() => grid.updateRow(index, 'showSuggestions', false), 200);
              }}
              placeholder="Type product name..."
              className={`w-full px-2 py-1.5 bg-transparent border-b text-sm
                         focus:outline-none focus:border-orange-500/50 placeholder:text-gray-700
                         ${row.matched ? 'border-green-500/30 text-white' : 'border-white/10 text-gray-300'}`}
            />
            {!row.matched && row.productQuery && !row.product && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-amber-400 font-bold
                               bg-amber-500/15 px-1.5 py-0.5 rounded">
                UNMATCHED
              </span>
            )}
            {row.showSuggestions && row.suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-3 z-30 mt-1 bg-gray-800 border border-white/10
                              rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {row.suggestions.map((product) => (
                  <button
                    key={product.id}
                    onMouseDown={() => grid.selectProduct(index, product)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between"
                  >
                    <span className="text-white">{product.name}</span>
                    <span className="text-gray-500 text-xs">
                      {product.purchase_price_paise > 0
                        ? formatINR(product.purchase_price_paise)
                        : formatINR(product.unit_price_paise)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pr-3">
            <input
              ref={(element) => grid.setCellRef(index, 'qty', element)}
              type="number"
              min={1}
              step={1}
              value={row.quantity || ''}
              onChange={(event) => (
                grid.updateRow(index, 'quantity', parseInt(event.target.value) || 0)
              )}
              onKeyDown={(event) => grid.handleCellKeyDown(event, index, 'qty')}
              className="w-full px-2 py-1.5 bg-transparent border-b border-white/10 text-sm text-right
                         text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="pr-3">
            <input
              ref={(element) => grid.setCellRef(index, 'price', element)}
              type="number"
              min={0}
              step={100}
              value={row.costPricePaise ? (row.costPricePaise / 100).toFixed(2) : ''}
              onChange={(event) => grid.updateRow(
                index,
                'costPricePaise',
                Math.round(parseFloat(event.target.value || '0') * 100)
              )}
              onKeyDown={(event) => grid.handleCellKeyDown(event, index, 'price')}
              placeholder="0.00"
              className="w-full px-2 py-1.5 bg-transparent border-b border-white/10 text-sm text-right
                         text-white focus:outline-none focus:border-orange-500/50 placeholder:text-gray-700"
            />
          </div>

          <div className="text-sm text-right text-gray-400 pr-3">
            {row.costPricePaise > 0 && row.quantity > 0
              ? formatINR(row.costPricePaise * row.quantity)
              : '—'}
          </div>

          <button
            onClick={() => grid.removeRow(index)}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-400
                       transition-colors rounded-md hover:bg-red-400/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        onClick={grid.addRow}
        className="w-full px-4 py-3 text-left text-sm text-gray-600 hover:text-gray-400
                   hover:bg-white/[0.02] transition-colors"
      >
        + Add row (or press Enter on last row)
      </button>
    </div>
  );
}
