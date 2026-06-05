'use client';

// =============================================================================
// BharatGrowth — Purchase Bill Entry "Speed Grid" (Phase 27)
// Keyboard-driven tabular entry + optional AI Vision scanner
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkUserOnboarded, type UserShopContext } from '@/lib/auth/checkUserOnboarded';
import { formatINR } from '@/lib/types/database';
import type { Product } from '@/lib/types/database';
import TopNav from '@/components/layout/TopNav';
import { savePurchaseOrder } from '@/lib/orders/orderQueries';

// ── Types ──

interface GridRow {
  id: string;
  productQuery: string;
  product: Product | null;
  quantity: number;
  costPricePaise: number;
  matched: boolean; // true = product matched from catalog, false = AI raw_name unmatched
  suggestions: Product[];
  showSuggestions: boolean;
}

function emptyRow(): GridRow {
  return {
    id: crypto.randomUUID(),
    productQuery: '',
    product: null,
    quantity: 1,
    costPricePaise: 0,
    matched: false,
    suggestions: [],
    showSuggestions: false,
  };
}

// ── Component ──

export default function NewPurchaseBillPage() {
  // ── Auth state ──
  const [shopCtx, setShopCtx] = useState<UserShopContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const shopId = shopCtx?.shopId ?? '';

  // ── Bill header state ──
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Grid state ──
  const [rows, setRows] = useState<GridRow[]>([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // ── AI Scanner state ──
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Focus refs: Map<rowIndex, Map<column, HTMLInputElement>> ──
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setCellRef = useCallback(
    (rowIdx: number, col: string, el: HTMLInputElement | null) => {
      const key = `${rowIdx}-${col}`;
      if (el) {
        cellRefs.current.set(key, el);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  const focusCell = useCallback((rowIdx: number, col: string) => {
    const key = `${rowIdx}-${col}`;
    const el = cellRefs.current.get(key);
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  // ── Auth init ──
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setAuthLoading(false);
        return;
      }
      checkUserOnboarded(session.user.id).then((ctx) => {
        setShopCtx(ctx);
        setAuthLoading(false);
      });
    });
  }, []);

  // ── Fetch AI scan quota on mount ──
  useEffect(() => {
    if (!shopId) return;
    const supabase = createClient();
    supabase
      .from('shops')
      .select('monthly_ai_scans')
      .eq('id', shopId)
      .single()
      .then(({ data }) => {
        if (data) setScansRemaining(data.monthly_ai_scans ?? 0);
      });
  }, [shopId]);

  // ── Product search for a row ──
  const searchProducts = useCallback(
    async (query: string, rowIdx: number) => {
      if (!shopId || query.length < 1) {
        setRows((prev) => {
          const next = [...prev];
          next[rowIdx] = { ...next[rowIdx], suggestions: [], showSuggestions: false };
          return next;
        });
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .or(`name.ilike.${query}%,sku.ilike.${query}%,barcode.eq.${query}`)
        .order('name')
        .limit(6);

      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = {
          ...next[rowIdx],
          suggestions: (data ?? []) as Product[],
          showSuggestions: (data ?? []).length > 0,
        };
        return next;
      });
    },
    [shopId]
  );

  // ── Select product from suggestions ──
  const selectProduct = useCallback(
    (rowIdx: number, product: Product) => {
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = {
          ...next[rowIdx],
          product,
          productQuery: product.name,
          costPricePaise: product.purchase_price_paise || product.unit_price_paise,
          matched: true,
          suggestions: [],
          showSuggestions: false,
        };
        return next;
      });
      // Auto-advance to quantity cell
      setTimeout(() => focusCell(rowIdx, 'qty'), 50);
    },
    [focusCell]
  );

  // ── Handle Enter key in grid cells ──
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, col: string) => {
      if (e.key !== 'Enter' && e.key !== 'Tab') return;

      // If suggestions are showing, select the first one
      if (col === 'product' && rows[rowIdx].showSuggestions && rows[rowIdx].suggestions.length > 0) {
        e.preventDefault();
        selectProduct(rowIdx, rows[rowIdx].suggestions[0]);
        return;
      }

      e.preventDefault();

      // Navigate: product → qty → price → next row product
      if (col === 'product') {
        focusCell(rowIdx, 'qty');
      } else if (col === 'qty') {
        focusCell(rowIdx, 'price');
      } else if (col === 'price') {
        // If this is the last row, add a new one
        if (rowIdx === rows.length - 1) {
          setRows((prev) => [...prev, emptyRow()]);
          setTimeout(() => focusCell(rowIdx + 1, 'product'), 50);
        } else {
          focusCell(rowIdx + 1, 'product');
        }
      }
    },
    [rows, focusCell, selectProduct]
  );

  // ── Update row field ──
  const updateRow = useCallback(
    (rowIdx: number, field: keyof GridRow, value: string | number | boolean) => {
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = { ...next[rowIdx], [field]: value };
        return next;
      });
    },
    []
  );

  // ── Remove row ──
  const removeRow = useCallback((rowIdx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return [emptyRow()];
      return prev.filter((_, i) => i !== rowIdx);
    });
  }, []);

  // ── In-memory product matcher (1 DB query for ALL products, then score in JS) ──
  // Scales to 10,000+ shops: one SELECT per scan, not N×items queries
  const findBestMatch = useCallback(
    (rawName: string, products: Product[]): Product | null => {
      const trimmed = rawName.trim().toLowerCase();
      if (!trimmed) return null;

      let bestProduct: Product | null = null;
      let bestScore = 0;

      for (const p of products) {
        const pName = p.name.toLowerCase();

        // Level 0: exact match → return immediately (highest confidence)
        if (pName === trimmed) return p;

        // Score by counting matching leading words (order-sensitive)
        const rawWords = trimmed.split(/\s+/);
        const pWords = pName.split(/\s+/);
        let matchCount = 0;
        for (let i = 0; i < Math.min(rawWords.length, pWords.length); i++) {
          if (rawWords[i] === pWords[i]) matchCount++;
          else break; // stop at first divergence — word order matters
        }

        // Bonus: if ALL leading words match AND word count is equal → near-exact
        if (matchCount === rawWords.length && matchCount === pWords.length) {
          return p; // should be caught by exact match above, but safety net
        }

        if (matchCount > bestScore) {
          bestScore = matchCount;
          bestProduct = p;
        }
      }

      // Require at least 2 matching leading words to avoid false positives
      // (e.g. "Apollo" alone matching "Apollo Bike Tyre" when user meant "Apollo Car Tyre")
      return bestScore >= 2 ? bestProduct : null;
    },
    []
  );

  // ── AI Scanner ──
  const handleScanBill = useCallback(async (file: File) => {
    setIsScanning(true);
    setScanError('');

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const base64 = btoa(binary);

      const res = await fetch('/api/vision/scan-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        setScanError(err.error || `Scan failed (${res.status})`);
        setIsScanning(false);
        return;
      }

      const data = await res.json();
      setScansRemaining(data.scans_remaining ?? null);

      // ── Single DB query: fetch ALL active products for this shop ──
      const supabase = createClient();
      const { data: allProducts } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      const catalog = (allProducts ?? []) as Product[];

      // ── Match each scanned item in-memory (zero extra DB queries) ──
      const newRows: GridRow[] = [];
      let matchedCount = 0;

      for (const item of data.items as Array<{
        raw_name: string;
        quantity: number;
        price_paise: number;
      }>) {
        const matchedProduct = findBestMatch(item.raw_name, catalog);
        if (matchedProduct) matchedCount++;

        newRows.push({
          id: crypto.randomUUID(),
          productQuery: item.raw_name,
          product: matchedProduct,
          quantity: item.quantity,
          costPricePaise: item.price_paise,
          matched: matchedProduct !== null,
          suggestions: [],
          showSuggestions: false,
        });
      }

      // Notify about unmatched items
      const unmatchedCount = newRows.length - matchedCount;
      if (unmatchedCount > 0) {
        setScanError(
          `${matchedCount}/${newRows.length} products matched. ${unmatchedCount} unmatched — select them manually before saving.`
        );
      }

      // Replace empty rows, keep any existing user-entered rows
      setRows((prev) => {
        const existingWithData = prev.filter((r) => r.product !== null);
        return [...existingWithData, ...newRows, emptyRow()];
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
    }

    setIsScanning(false);
  }, [shopId, findBestMatch]);

  // ── Save bill (single atomic RPC — 1 HTTP request, 1 Postgres transaction) ──
  const handleSave = useCallback(async () => {
    const validRows = rows.filter((r) => r.product !== null && r.quantity > 0);
    if (validRows.length === 0) {
      setSaveError('Add at least one product to save');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    if (!supplierName.trim()) {
      setSaveError('Supplier name is required');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    setIsSaving(true);
    setSaveError('');

    const supabase = createClient();

    // Calculate bill total
    const totalAmountPaise = validRows.reduce(
      (sum, r) => sum + r.costPricePaise * r.quantity,
      0
    );

    // Skipped row count for user feedback
    const totalRowsWithData = rows.filter((r) => r.productQuery.trim()).length;
    const skippedCount = totalRowsWithData - validRows.length;

    // Single atomic RPC: bill insert + all stock adjustments in one transaction
    const { data: result, error: rpcErr } = await supabase.rpc('save_purchase_bill', {
      p_bill: {
        shop_id: shopId,
        supplier_name: supplierName.trim(),
        bill_number: billNumber.trim() || null,
        bill_date: billDate,
        total_amount_paise: totalAmountPaise,
        created_by: shopCtx?.userId || null,
      },
      p_items: validRows
        .filter((r): r is GridRow & { product: Product } => r.product !== null)
        .map((r) => ({
          product_id: r.product.id,
          quantity: r.quantity,
          unit_price_paise: r.costPricePaise,
        })),
    });

    setIsSaving(false);

    if (rpcErr) {
      console.error('[PurchaseBill] save_purchase_bill FAILED:', rpcErr.message);
      setSaveError(`Failed to save bill: ${rpcErr.message}`);
      setTimeout(() => setSaveError(''), 8000);
      return;
    }

    const itemsProcessed = (result as { bill_id: string; items_processed: number })?.items_processed ?? 0;
    const skippedMsg = skippedCount > 0
      ? ` (${skippedCount} unmatched item${skippedCount > 1 ? 's' : ''} skipped)`
      : '';

    console.log('[PurchaseBill] save_purchase_bill OK:', result);
    setSaveSuccess(
      `Bill saved! ${itemsProcessed} item${itemsProcessed !== 1 ? 's' : ''} stocked in (${formatINR(totalAmountPaise)})${skippedMsg}`
    );

    // Reset form
    setSupplierName('');
    setBillNumber('');
    setRows([emptyRow()]);
    setTimeout(() => setSaveSuccess(''), 6000);
  }, [rows, supplierName, billNumber, billDate, shopId, shopCtx]);

  // ── Save as Draft Purchase Order (no inventory changes) ──
  const handleSaveDraftPO = useCallback(async () => {
    const validPORows = rows.filter((r) => r.product !== null && r.quantity > 0);
    if (validPORows.length === 0) {
      setSaveError('Add at least one product to create a PO');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    if (!supplierName.trim()) {
      setSaveError('Supplier name is required');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }

    setIsCreatingPO(true);
    setSaveError('');

    const totalAmountPaise = validPORows.reduce(
      (sum, r) => sum + r.costPricePaise * r.quantity,
      0
    );

    const result = await savePurchaseOrder({
      shopId,
      supplierName: supplierName.trim(),
      expectedDate: billDate,
      totalAmountPaise,
      createdBy: shopCtx?.userId,
      items: validPORows
        .filter((r): r is GridRow & { product: Product } => r.product !== null)
        .map((r) => ({
          productId: r.product.id,
          quantity: r.quantity,
          expectedPricePaise: r.costPricePaise,
        })),
    });

    setIsCreatingPO(false);

    if (result.success) {
      const poNumber = (result.data?.po_number as string) ?? '';
      setSaveSuccess(`Purchase Order ${poNumber} created! No stock changes until received.`);
      setSupplierName('');
      setBillNumber('');
      setRows([emptyRow()]);
      setTimeout(() => setSaveSuccess(''), 6000);
    } else {
      setSaveError(result.error ?? 'Failed to create purchase order');
      setTimeout(() => setSaveError(''), 8000);
    }
  }, [rows, supplierName, billDate, shopId, shopCtx]);

  // ── Computed totals ──
  const validRows = rows.filter((r) => r.product !== null);
  const grandTotal = rows.reduce(
    (sum, r) => sum + (r.product ? r.costPricePaise * r.quantity : 0),
    0
  );

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
                  onChange={(e) => {
                    const val = e.target.value;
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...next[idx],
                        productQuery: val,
                        ...(!val ? { product: null, matched: false } : {}),
                      };
                      return next;
                    });
                    searchProducts(val, idx);
                  }}
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
            onClick={() => {
              setRows((prev) => [...prev, emptyRow()]);
              setTimeout(() => focusCell(rows.length, 'product'), 50);
            }}
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
              onClick={() => {
                setRows([emptyRow()]);
                setSupplierName('');
                setBillNumber('');
                setSaveSuccess('');
                setSaveError('');
              }}
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
