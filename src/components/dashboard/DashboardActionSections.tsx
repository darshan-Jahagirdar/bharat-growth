import Image from 'next/image';
import { AlertTriangle, FileText } from 'lucide-react';
import {
  type CreditCustomer,
  type LowStockProduct,
} from '@/lib/dashboard/dashboardQueries';
import { formatINR } from '@/lib/types/database';
import { WhatsAppIcon } from './WhatsAppIcon';

interface DashboardActionSectionsProps {
  khataCustomers: CreditCustomer[];
  lowStockProducts: LowStockProduct[];
  onReminder: (customer: CreditCustomer) => void;
}

export function DashboardActionSections({
  khataCustomers,
  lowStockProducts,
  onReminder,
}: DashboardActionSectionsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Khata Hitlist</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {khataCustomers.length} customer{khataCustomers.length !== 1 ? 's' : ''} with credit
            </p>
          </div>
          <FileText className="w-4 h-4 text-red-400/60" />
        </div>

        {khataCustomers.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-gray-600 text-sm">No outstanding credit</div>
            <div className="text-gray-700 text-[11px] mt-1">
              Credit invoices will appear here
            </div>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {khataCustomers.map((customer) => (
              <div
                key={customer.id}
                className="bg-gray-900/60 border border-gray-800/50 rounded-lg px-3 py-2.5
                           flex items-center justify-between hover:border-gray-700/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {customer.photo_url ? (
                      <Image
                        src={customer.photo_url}
                        alt={customer.name ?? 'Customer'}
                        fill
                        sizes="32px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 text-xs font-bold">
                        {(customer.name ?? customer.phone_number).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">
                      {customer.name ?? customer.phone_number}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {customer.phone_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-dues">
                      {formatINR(customer.credit_balance_paise)}
                    </div>
                  </div>
                  <button
                    onClick={() => onReminder(customer)}
                    title={`Send WhatsApp reminder to ${customer.name ?? customer.phone_number}`}
                    className="w-7 h-7 rounded-full bg-emerald-900/40 border border-emerald-800/50
                               flex items-center justify-center
                               hover:bg-emerald-800/60 hover:border-emerald-700 transition-colors"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Low Stock Alerts</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} below threshold
            </p>
          </div>
          <AlertTriangle className="w-4 h-4 text-amber-400/60" />
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-gray-600 text-sm">All stocked up</div>
            <div className="text-gray-700 text-[11px] mt-1">
              Products with stock &lt; 10 will appear here
            </div>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {lowStockProducts.map((product) => {
              const isZero = product.quantity_in_stock <= 0;
              return (
                <div
                  key={product.id}
                  className={`bg-gray-900/60 border rounded-lg px-3 py-2.5
                             flex items-center justify-between transition-colors
                             ${isZero
                               ? 'border-red-800/40 hover:border-red-700/50'
                               : 'border-gray-800/50 hover:border-gray-700/60'
                             }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">
                      {product.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Unit: {product.unit}
                      {product.reorder_level !== null && (
                        <> &middot; Reorder at {product.reorder_level}</>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold
                        ${isZero
                          ? 'bg-red-500/15 text-red-400'
                          : product.quantity_in_stock <= 3
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                    >
                      {isZero ? 'OUT' : product.quantity_in_stock} {!isZero && product.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
