import { ShoppingCart, Truck } from 'lucide-react';
import type { OrdersTab } from '@/lib/orders/orderPresentation';

interface OrdersHeaderProps {
  activeTab: OrdersTab;
  salesActiveCount: number;
  purchaseActiveCount: number;
  onTabChange: (tab: OrdersTab) => void;
}

export function OrdersHeader({
  activeTab,
  salesActiveCount,
  purchaseActiveCount,
  onTabChange,
}: OrdersHeaderProps) {
  return (
    <>
      <div>
        <h1 className="text-lg font-bold text-gray-200">Order Management</h1>
        <p className="text-xs text-gray-500">
          Track sales reservations and supplier purchase orders. Convert to
          invoices or bills when ready.
        </p>
      </div>

      <div className="flex items-center gap-1 bg-slate-900/50 border border-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => onTabChange('sales')}
          className={`
            flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === 'sales'
              ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }
          `}
        >
          <ShoppingCart className="w-4 h-4" />
          Sales Orders
          {salesActiveCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400">
              {salesActiveCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onTabChange('purchase')}
          className={`
            flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === 'purchase'
              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }
          `}
        >
          <Truck className="w-4 h-4" />
          Purchase Orders
          {purchaseActiveCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400">
              {purchaseActiveCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
