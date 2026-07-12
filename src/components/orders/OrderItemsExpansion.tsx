import { Package } from 'lucide-react';
import { formatINR } from '@/lib/types/database';

interface DisplayOrderItem {
  id: string;
  quantity: number;
  productName: string | null;
  productUnit: string | null;
  unitPricePaise: number;
}

interface OrderItemsExpansionProps {
  isExpanded: boolean;
  items: DisplayOrderItem[];
  notes: string | null;
}

export function OrderItemsExpansion({
  isExpanded,
  items,
  notes,
}: OrderItemsExpansionProps) {
  if (!isExpanded) return null;

  if (items.length === 0) {
    return (
      <tr>
        <td
          colSpan={8}
          className="bg-slate-950/50 px-4 py-4 text-xs text-gray-600"
        >
          No line items in this order.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={8} className="bg-slate-950/50 px-4 py-4">
        <div className="space-y-2">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">
            Line Items
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 text-gray-600" />
                <div>
                  <div className="text-sm text-gray-200">
                    {item.productName ?? 'Unknown product'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Qty: {item.quantity}
                    {item.productUnit ? ` ${item.productUnit}` : ''}{' '}
                    @ {formatINR(item.unitPricePaise)}/unit
                  </div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-300">
                {formatINR(item.unitPricePaise * Math.round(item.quantity))}
              </div>
            </div>
          ))}
          {notes && (
            <div className="px-4 py-2 text-xs text-gray-500 italic">
              Note: {notes}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
