import type { PurchaseBillSaveController } from '@/lib/purchases/usePurchaseBillSave';

interface PurchaseBillFieldsProps {
  save: PurchaseBillSaveController;
}

export function PurchaseBillFields({ save }: PurchaseBillFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
          Supplier Name *
        </label>
        <input
          type="text"
          value={save.supplierName}
          onChange={(event) => save.setSupplierName(event.target.value)}
          placeholder="e.g. MRF Distributor"
          className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-lg
                     text-white text-sm placeholder:text-gray-600
                     focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
          Bill Number
        </label>
        <input
          type="text"
          value={save.billNumber}
          onChange={(event) => save.setBillNumber(event.target.value)}
          placeholder="e.g. INV-2026-0451"
          className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-lg
                     text-white text-sm placeholder:text-gray-600
                     focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
          Bill Date
        </label>
        <input
          type="date"
          value={save.billDate}
          onChange={(event) => save.setBillDate(event.target.value)}
          className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-lg
                     text-white text-sm
                     focus:outline-none focus:border-orange-500/50"
        />
      </div>
    </div>
  );
}
