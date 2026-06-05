'use client';

// =============================================================================
// BharatGrowth — Bulk CSV Product Uploader (Phase 19)
// Drag-and-drop CSV → preview table → Supabase bulk insert
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/types/database';
import { X, Download, Upload, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';

// ── Props ──

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  onSuccess: () => void;
}

// ── Valid GST rates ──
const VALID_GST_RATES = new Set([0, 5, 12, 18, 28]);

// ── CSV Row (as parsed by PapaParse with headers) ──
interface CsvRow {
  Name?: string;
  Price_Rupees?: string;
  GST_Percent?: string;
  Category?: string;
  Barcode?: string;
  HSN_Code?: string;
}

// ── Validated row ──
interface ParsedProduct {
  name: string;
  priceRupees: number;
  sellingPricePaise: number;
  gstPercent: number;
  category: string;
  barcode: string;
  hsnCode: string;
  valid: boolean;
  errors: string[];
}

// ── Template CSV content ──
const CSV_TEMPLATE = `Name,Price_Rupees,GST_Percent,Category,Barcode,HSN_Code
Apollo Amazer 4G Life 185/65 R15,4500,28,Tyres,,40111000
MRF ZVTV 165/80 R14,3200,28,Tyres,,40111000
Kaju Katli 500g,450,5,Sweets,,17049020
Rasgulla Tin 1kg,320,5,Sweets,,17049020
Cotton Kurta Set,1200,5,Garments,,62052000`;

export default function BulkUploadModal({
  isOpen,
  onClose,
  shopId,
  onSuccess,
}: BulkUploadModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedProduct[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset state ──
  const resetState = useCallback(() => {
    setParsedRows([]);
    setFileName(null);
    setUploadResult(null);
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Close handler ──
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // ── Download CSV template ──
  const downloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bharatgrowth_product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Parse and validate CSV ──
  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setUploadResult(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedProduct[] = results.data.map((row) => {
          const errors: string[] = [];

          // Name
          const name = (row.Name ?? '').trim();
          if (!name) errors.push('Name is required');

          // Price
          const priceStr = (row.Price_Rupees ?? '').trim();
          const priceRupees = parseFloat(priceStr);
          if (!priceStr || isNaN(priceRupees) || priceRupees <= 0) {
            errors.push('Price must be a positive number');
          }

          // GST
          const gstStr = (row.GST_Percent ?? '18').trim();
          const gstPercent = parseInt(gstStr, 10);
          if (isNaN(gstPercent) || !VALID_GST_RATES.has(gstPercent)) {
            errors.push('GST must be 0, 5, 12, 18, or 28');
          }

          // HSN (default to generic '0000' if empty)
          const hsnCode = (row.HSN_Code ?? '').trim() || '0000';

          // Category & Barcode (optional)
          const category = (row.Category ?? '').trim();
          const barcode = (row.Barcode ?? '').trim();

          const sellingPricePaise = isNaN(priceRupees)
            ? 0
            : Math.round(priceRupees * 100);

          return {
            name,
            priceRupees: isNaN(priceRupees) ? 0 : priceRupees,
            sellingPricePaise,
            gstPercent: isNaN(gstPercent) ? 18 : gstPercent,
            category,
            barcode,
            hsnCode,
            valid: errors.length === 0,
            errors,
          };
        });

        setParsedRows(rows);
      },
    });
  }, []);

  // ── Drag-and-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Bulk insert to Supabase ──
  const handleUpload = useCallback(async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const supabase = createClient();
      const insertPayload = validRows.map((r) => ({
        shop_id: shopId,
        name: r.name,
        selling_price_paise: r.sellingPricePaise,
        unit_price_paise: r.sellingPricePaise, // default cost = selling price
        gst_rate_percent: r.gstPercent,
        hsn_code: r.hsnCode,
        category: r.category || null,
        barcode: r.barcode || null,
        unit: 'piece' as const,
        is_active: true,
        vertical_attrs: {},
      }));

      const { error } = await supabase.from('products').insert(insertPayload);

      if (error) {
        setUploadResult(`Error: ${error.message}`);
      } else {
        setUploadResult(`Successfully added ${validRows.length} product${validRows.length !== 1 ? 's' : ''}!`);
        onSuccess();
        // Auto-close after brief delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (err) {
      setUploadResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, [parsedRows, shopId, onSuccess, handleClose]);

  // ── Derived ──
  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl
                      w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100">Bulk Upload Products</h2>
              <p className="text-[11px] text-gray-500">Import your catalog from a CSV file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center
                       transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Template Download */}
          <div className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-gray-300 font-medium">Need a template?</p>
              <p className="text-[11px] text-gray-500">
                Download our CSV template with sample data
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700
                         border border-gray-600/50 rounded-lg text-xs text-gray-300 font-medium
                         transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>

          {/* Drop Zone */}
          {parsedRows.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${isDragOver
                  ? 'border-orange-500 bg-orange-500/5'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/20'
                }`}
            >
              <Upload
                className={`w-8 h-8 mx-auto mb-3 ${
                  isDragOver ? 'text-orange-400' : 'text-gray-600'
                }`}
              />
              <p className="text-sm text-gray-300 font-medium">
                {isDragOver ? 'Drop your CSV here' : 'Drag & drop your CSV file here'}
              </p>
              <p className="text-[11px] text-gray-600 mt-1">
                or click to browse &middot; .csv files only
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <>
              {/* File info bar */}
              <div className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-300">{fileName}</span>
                  <span className="text-[11px] text-gray-500">
                    &middot; {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  {validCount > 0 && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> {validCount} valid
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <XCircle className="w-3 h-3" /> {invalidCount} invalid
                    </span>
                  )}
                  <button
                    onClick={resetState}
                    className="text-gray-500 hover:text-gray-300 transition-colors underline"
                  >
                    Replace file
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800/60 sticky top-0 z-10">
                      <tr className="text-gray-500 uppercase tracking-wider">
                        <th className="w-8 px-3 py-2.5 text-center">#</th>
                        <th className="px-3 py-2.5 text-left">Name</th>
                        <th className="px-3 py-2.5 text-right">Price</th>
                        <th className="px-3 py-2.5 text-center">GST</th>
                        <th className="px-3 py-2.5 text-left hidden sm:table-cell">Category</th>
                        <th className="px-3 py-2.5 text-left hidden md:table-cell">HSN</th>
                        <th className="w-8 px-3 py-2.5 text-center">OK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-gray-800/50 ${
                            row.valid
                              ? 'hover:bg-gray-800/20'
                              : 'bg-red-950/20'
                          }`}
                          title={row.errors.length > 0 ? row.errors.join(', ') : undefined}
                        >
                          <td className="px-3 py-2 text-center text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-200 font-medium truncate max-w-[180px]">
                            {row.name || <span className="text-red-400 italic">Missing</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">
                            {row.priceRupees > 0
                              ? formatINR(row.sellingPricePaise)
                              : <span className="text-red-400">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-center text-gray-400">{row.gstPercent}%</td>
                          <td className="px-3 py-2 text-gray-500 hidden sm:table-cell truncate max-w-[100px]">
                            {row.category || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-500 font-mono hidden md:table-cell">
                            {row.hsnCode}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.valid ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                uploadResult.startsWith('Error')
                  ? 'bg-red-900/40 border border-red-800 text-red-300'
                  : 'bg-emerald-900/40 border border-emerald-800 text-emerald-300'
              }`}
            >
              {uploadResult}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {parsedRows.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">
              {validCount} product{validCount !== 1 ? 's' : ''} will be added &middot;
              {invalidCount > 0 && ` ${invalidCount} skipped`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400
                           text-sm rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={validCount === 0 || uploading}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed
                           text-white text-sm font-semibold rounded-lg transition-colors
                           flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Confirm & Upload ({validCount})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
