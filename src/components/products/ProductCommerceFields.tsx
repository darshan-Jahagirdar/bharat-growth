import type { GstRatePercent, ProductUnit } from '@/lib/types/database';
import {
  GST_RATES,
  PRODUCT_UNITS,
  type ProductFieldSetter,
  type ProductForm,
} from '@/lib/products/productForm';

interface ProductCommerceFieldsProps {
  form: ProductForm;
  setField: ProductFieldSetter;
}

export function ProductCommerceFields({ form, setField }: ProductCommerceFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            HSN Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.hsn_code}
            onChange={(event) => setField('hsn_code', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
            placeholder="e.g. 40111000"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(event) => setField('sku', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
            placeholder="e.g. TYR-APO-185"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Barcode</label>
          <input
            type="text"
            value={form.barcode}
            onChange={(event) => setField('barcode', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
            placeholder="Scan or type"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cost Price (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.unit_price_paise}
            onChange={(event) => setField('unit_price_paise', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Selling Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.selling_price_paise}
            onChange={(event) => setField('selling_price_paise', event.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 font-mono focus:border-orange-500 focus:outline-none"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">GST Rate</label>
          <select
            value={form.gst_rate_percent}
            onChange={(event) =>
              setField('gst_rate_percent', Number(event.target.value) as GstRatePercent)
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
          >
            {GST_RATES.map((rate) => (
              <option key={rate} value={rate}>{rate}%</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Unit</label>
          <select
            value={form.unit}
            onChange={(event) => setField('unit', event.target.value as ProductUnit)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                       text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
          >
            {PRODUCT_UNITS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
