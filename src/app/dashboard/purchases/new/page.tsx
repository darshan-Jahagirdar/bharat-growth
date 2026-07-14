'use client';

// =============================================================================
// BharatGrowth — Purchase Bill Entry "Speed Grid" (Phase 27)
// Keyboard-driven tabular entry + optional AI Vision scanner
// =============================================================================

import { useEffect } from 'react';
import { formatINR } from '@/lib/types/database';
import TopNav from '@/components/layout/TopNav';
import { usePurchaseBillContext } from '@/lib/purchases/usePurchaseBillContext';
import { usePurchaseBillSave } from '@/lib/purchases/usePurchaseBillSave';
import { usePurchaseGrid } from '@/lib/purchases/usePurchaseGrid';
import { usePurchaseScanner } from '@/lib/purchases/usePurchaseScanner';
import {
  calculateGrandTotal,
  getSelectedRows,
} from './purchaseBillTransforms';

// ── Component ──

export default function NewPurchaseBillPage() {
  const {
    authLoading,
    scansRemaining,
    setScansRemaining,
    shopContext: shopCtx,
    shopId,
  } = usePurchaseBillContext();
  const grid = usePurchaseGrid(shopId);
  const scanner = usePurchaseScanner({
    setRows: grid.setRows,
    setScansRemaining,
    shopId,
  });
  const save = usePurchaseBillSave({
    rows: grid.rows,
    setRows: grid.setRows,
    shopContext: shopCtx,
    shopId,
  });
  const {
    addRow,
    handleCellKeyDown,
    removeRow,
    rows,
    selectProduct,
    setCellRef,
    updateProductQuery,
    updateRow,
  } = grid;
  const { fileInputRef, handleScanBill, isScanning, scanError } = scanner;
  const {
    billDate,
    billNumber,
    handleClear,
    handleSave,
    handleSaveDraftPO,
    isCreatingPO,
    isSaving,
    saveError,
    saveSuccess,
    setBillDate,
    setBillNumber,
    setSupplierName,
    supplierName,
  } = save;
  const validRows = getSelectedRows(rows);
  const grandTotal = calculateGrandTotal(rows);

  // ── Loading / Auth guard ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shopCtx) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Please log in to continue.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav />

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">New Purchase Bill</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Log supplier bills to update inventory &amp; cost prices
            </p>
          </div>

          {/* AI Scanner Button */}
          <div className="flex items-center gap-3">
            {scansRemaining !== null && (
              <span className="text-xs text-gray-500">
                {scansRemaining} AI scans left
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning || (scansRemaining !== null && scansRemaining <= 0)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
                         bg-purple-600/20 text-purple-300 border border-purple-500/30
                         hover:bg-purple-600/30 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-300/40 border-t-purple-300 rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scan Bill (AI)
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanBill(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* ── Error / Success toasts ── */}
        {scanError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {scanError}
          </div>
        )}
        {saveError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {saveSuccess}
          </div>
        )}

        {/* ── Bill Header Fields ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
              Supplier Name *
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
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
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
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
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-lg
                         text-white text-sm
                         focus:outline-none focus:border-orange-500/50"
            />
          </div>
        </div>

        {/* ── Speed Grid ── */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
          {/* Grid Header */}
          <div className="grid grid-cols-[40px_1fr_120px_160px_140px_48px] gap-0 px-4 py-3
                          bg-gray-900 border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
            <div>#</div>
            <div>Product</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Cost Price (₹)</div>
            <div className="text-right">Total</div>
            <div />
          </div>

          {/* Grid Rows */}
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className={`grid grid-cols-[40px_1fr_120px_160px_140px_48px] gap-0 px-4 py-1.5
                          items-center border-b border-white/5 last:border-b-0
                          ${!row.matched && row.productQuery && !row.product
                            ? 'bg-amber-500/10 border-l-2 border-l-amber-500/50'
                            : ''
                          }`}
            >
              {/* Row number */}
              <div className="text-xs text-gray-600">{idx + 1}</div>

              {/* Product — autocomplete search */}
              <div className="relative pr-3">
                <input
                  ref={(el) => setCellRef(idx, 'product', el)}
                  type="text"
                  value={row.productQuery}
                  onChange={(e) => updateProductQuery(idx, e.target.value)}
                  onKeyDown={(e) => handleCellKeyDown(e, idx, 'product')}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => updateRow(idx, 'showSuggestions', false), 200);
                  }}
                  placeholder="Type product name..."
                  className={`w-full px-2 py-1.5 bg-transparent border-b text-sm
                             focus:outline-none focus:border-orange-500/50 placeholder:text-gray-700
                             ${row.matched ? 'border-green-500/30 text-white' : 'border-white/10 text-gray-300'}`}
                />
                {/* Unmatched AI indicator — prominent so user knows to fix */}
                {!row.matched && row.productQuery && !row.product && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-amber-400 font-bold
                                   bg-amber-500/15 px-1.5 py-0.5 rounded">
                    UNMATCHED
                  </span>
                )}
                {/* Suggestions dropdown */}
                {row.showSuggestions && row.suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-3 z-30 mt-1 bg-gray-800 border border-white/10
                                  rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {row.suggestions.map((p) => (
                      <button
                        key={p.id}
                        onMouseDown={() => selectProduct(idx, p)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between"
                      >
                        <span className="text-white">{p.name}</span>
                        <span className="text-gray-500 text-xs">
                          {p.purchase_price_paise > 0
                            ? formatINR(p.purchase_price_paise)
                            : formatINR(p.unit_price_paise)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="pr-3">
                <input
                  ref={(el) => setCellRef(idx, 'qty', el)}
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity || ''}
                  onChange={(e) => updateRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => handleCellKeyDown(e, idx, 'qty')}
                  className="w-full px-2 py-1.5 bg-transparent border-b border-white/10 text-sm text-right
                             text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Cost Price */}
              <div className="pr-3">
                <input
                  ref={(el) => setCellRef(idx, 'price', el)}
                  type="number"
                  min={0}
                  step={100}
                  value={row.costPricePaise ? (row.costPricePaise / 100).toFixed(2) : ''}
                  onChange={(e) =>
                    updateRow(idx, 'costPricePaise', Math.round(parseFloat(e.target.value || '0') * 100))
                  }
                  onKeyDown={(e) => handleCellKeyDown(e, idx, 'price')}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-transparent border-b border-white/10 text-sm text-right
                             text-white focus:outline-none focus:border-orange-500/50 placeholder:text-gray-700"
                />
              </div>

              {/* Line Total */}
              <div className="text-sm text-right text-gray-400 pr-3">
                {row.costPricePaise > 0 && row.quantity > 0
                  ? formatINR(row.costPricePaise * row.quantity)
                  : '—'}
              </div>

              {/* Delete row */}
              <button
                onClick={() => removeRow(idx)}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-400
                           transition-colors rounded-md hover:bg-red-400/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add Row Button */}
          <button
            onClick={addRow}
            className="w-full px-4 py-3 text-left text-sm text-gray-600 hover:text-gray-400
                       hover:bg-white/[0.02] transition-colors"
          >
            + Add row (or press Enter on last row)
          </button>
        </div>

        {/* ── Footer: Totals + Save ── */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {validRows.length} item{validRows.length !== 1 ? 's' : ''} &middot;{' '}
            <span className="text-white font-semibold text-base">
              {formatINR(grandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClear}
              className="px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10
                         hover:bg-white/5 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleSaveDraftPO}
              disabled={isCreatingPO || isSaving || validRows.length === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-medium
                         bg-violet-900/40 text-violet-300 border border-violet-700/50
                         hover:bg-violet-900/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreatingPO ? (
                <>
                  <div className="w-4 h-4 border-2 border-violet-300/40 border-t-violet-300 rounded-full animate-spin" />
                  Creating PO...
                </>
              ) : (
                <>Save as PO</>
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isCreatingPO || validRows.length === 0}
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-orange-500 text-white
                         hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save Bill (F10)</>
              )}
            </button>
          </div>
        </div>

        {/* ── F10 keyboard shortcut ── */}
        <KeyboardShortcut onSave={handleSave} />
      </div>
    </div>
  );
}

// ── F10 Save shortcut ──
function KeyboardShortcut({ onSave }: { onSave: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  return null;
}
