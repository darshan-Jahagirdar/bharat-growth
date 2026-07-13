import { AlertTriangle } from 'lucide-react';
import type { NegativeStockProduct } from '@/lib/dashboard/dashboardQueries';

interface DashboardAnomaliesProps {
  products: NegativeStockProduct[];
  onResolve: (product: NegativeStockProduct) => void;
}

export function DashboardAnomalies({
  products,
  onResolve,
}: DashboardAnomaliesProps) {
  if (products.length === 0) return null;

  return (
    <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <h2 className="text-sm font-bold text-red-300">
          Stock Anomalies ({products.length})
        </h2>
        <span className="text-[10px] text-red-400/70 ml-1">Items sold past zero — needs reconciliation</span>
      </div>
      <div className="space-y-2">
        {products.map((item) => (
          <div
            key={item.inventory_id}
            className="flex items-center justify-between bg-red-950/40 border border-red-900/30 rounded-lg px-4 py-2.5"
          >
            <div>
              <span className="text-sm text-gray-200 font-medium">{item.name}</span>
              <span className="text-xs text-red-400 font-mono ml-2">
                Stock: {item.quantity_in_stock} {item.unit}
              </span>
            </div>
            <button
              onClick={() => onResolve(item)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-800/40 text-red-300
                         hover:bg-red-700/50 transition-colors border border-red-800/50"
            >
              Log Missing Delivery
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
