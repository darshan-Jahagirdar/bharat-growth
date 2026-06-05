'use client';

// =============================================================================
// BharatGrowth — Digital Receipt Client Loader
// Fetches invoice data via browser Supabase client (public anon access)
// Mobile-optimized, clean modern design — customers see this via WhatsApp link
// =============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ReceiptItem {
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price_paise: number;
  gst_rate_percent: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
}

interface ReceiptData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  document_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  subtotal_paise: number;
  cgst_total_paise: number;
  sgst_total_paise: number;
  igst_total_paise: number;
  discount_paise: number;
  round_off_paise: number;
  total_paise: number;
  payment_mode: string;
  is_inter_state: boolean;
  created_at: string;
  shop: {
    business_name: string;
    gstin: string | null;
    gst_type: string;
    address_line_1: string | null;
    city: string | null;
    state_code: string;
    phone: string | null;
  };
  items: ReceiptItem[];
}

type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const PAYMENT_ICONS: Record<string, string> = {
  cash: '💵',
  upi: '📱',
  card: '💳',
  credit: '📒',
  split: '🔀',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
  split: 'Split',
};

interface ReceiptLoaderProps {
  invoiceId: string;
}

export function ReceiptLoader({ invoiceId }: ReceiptLoaderProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReceipt() {
      const supabase = createClient();

      // Fetch invoice
      const { data: invoice, error: invoiceErr } = await supabase
        .from('invoices')
        .select(`
          id, invoice_number, invoice_date, document_type,
          customer_name, customer_phone, customer_gstin,
          subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
          discount_paise, round_off_paise, total_paise,
          payment_mode, is_inter_state, created_at,
          shop:shops!inner(business_name, gstin, gst_type, address_line_1, city, state_code, phone)
        `)
        .eq('id', invoiceId)
        .single();

      if (cancelled) return;

      if (invoiceErr || !invoice) {
        setLoadState(invoiceErr?.code === 'PGRST116' ? 'not_found' : 'error');
        return;
      }

      // Fetch line items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('product_name, hsn_code, quantity, unit, unit_price_paise, gst_rate_percent, cgst_paise, sgst_paise, igst_paise, total_paise')
        .eq('invoice_id', invoiceId)
        .order('created_at');

      if (cancelled) return;

      const shop = Array.isArray(invoice.shop) ? invoice.shop[0] : invoice.shop;

      document.title = `Receipt ${invoice.invoice_number} | ${shop.business_name}`;

      setReceipt({
        ...invoice,
        shop,
        items: (items ?? []) as ReceiptItem[],
      } as ReceiptData);
      setLoadState('loaded');
    }

    fetchReceipt();
    return () => { cancelled = true; };
  }, [invoiceId]);

  // ── Loading ──
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading your receipt...</p>
        </div>
      </div>
    );
  }

  // ── Not Found ──
  if (loadState === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <p className="text-5xl mb-3">🧾</p>
          <h1 className="text-xl font-semibold text-gray-700 mb-1">Receipt Not Found</h1>
          <p className="text-gray-400 text-sm">This receipt link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (loadState === 'error' || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <p className="text-5xl mb-3">⚠️</p>
          <h1 className="text-xl font-semibold text-gray-700 mb-1">Something went wrong</h1>
          <p className="text-gray-400 text-sm">Please try again later.</p>
        </div>
      </div>
    );
  }

  const isComposition = receipt.shop.gst_type === 'composition';
  const isTaxInvoice = receipt.document_type === 'tax_invoice' && !isComposition;
  const totalTaxPaise = receipt.cgst_total_paise + receipt.sgst_total_paise + receipt.igst_total_paise;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Receipt Card ── */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* ── Header ── */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-5 py-5 text-white">
            <div className="text-center mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">
                {isTaxInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
              </p>
              {isComposition && (
                <p className="text-[9px] text-yellow-400/80 mt-0.5 leading-tight">
                  Composition taxable person, not eligible to collect tax on supplies
                </p>
              )}
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-bold">{receipt.shop.business_name}</h1>
                {receipt.shop.gstin && (
                  <p className="text-gray-400 text-[11px] mt-0.5 font-mono">GSTIN: {receipt.shop.gstin}</p>
                )}
                {receipt.shop.city && (
                  <p className="text-gray-400 text-xs mt-0.5">{receipt.shop.city}</p>
                )}
                {receipt.shop.phone && (
                  <p className="text-gray-400 text-xs">Ph: {receipt.shop.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Invoice Meta ── */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Invoice</p>
              <p className="text-sm font-semibold text-gray-800 font-mono">{receipt.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Date</p>
              <p className="text-sm text-gray-700">{formatDate(receipt.invoice_date)}</p>
              <p className="text-[11px] text-gray-400">{formatTime(receipt.created_at)}</p>
            </div>
          </div>

          {/* ── Customer Info ── */}
          {(receipt.customer_name || receipt.customer_phone) && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Billed To</p>
              {receipt.customer_name && (
                <p className="text-sm font-medium text-gray-800">{receipt.customer_name}</p>
              )}
              {receipt.customer_phone && (
                <p className="text-xs text-gray-500">{receipt.customer_phone}</p>
              )}
              {receipt.customer_gstin && (
                <p className="text-xs text-gray-500 font-mono">GSTIN: {receipt.customer_gstin}</p>
              )}
            </div>
          )}

          {/* ── Line Items ── */}
          <div className="px-5 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-center py-2 font-medium w-12">Qty</th>
                  <th className="text-right py-2 font-medium w-20">Rate</th>
                  <th className="text-right py-2 font-medium w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <p className="text-gray-800 font-medium text-[13px] leading-tight">
                        {item.product_name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        HSN: {item.hsn_code}
                        {isTaxInvoice && item.gst_rate_percent > 0 && (
                          <span className="ml-1">· GST {item.gst_rate_percent}%</span>
                        )}
                      </p>
                    </td>
                    <td className="text-center text-gray-600 text-[13px]">
                      {item.quantity}
                      {item.unit !== 'piece' && (
                        <span className="text-[10px] text-gray-400 block">{item.unit}</span>
                      )}
                    </td>
                    <td className="text-right text-gray-600 text-[13px] font-mono">
                      {formatINR(item.unit_price_paise)}
                    </td>
                    <td className="text-right text-gray-800 text-[13px] font-mono font-medium">
                      {formatINR(item.total_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
            {!isComposition && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span className="font-mono">{formatINR(receipt.subtotal_paise)}</span>
              </div>
            )}

            {isTaxInvoice && !receipt.is_inter_state && receipt.cgst_total_paise > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>CGST</span>
                  <span className="font-mono">{formatINR(receipt.cgst_total_paise)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>SGST</span>
                  <span className="font-mono">{formatINR(receipt.sgst_total_paise)}</span>
                </div>
              </>
            )}

            {isTaxInvoice && receipt.is_inter_state && receipt.igst_total_paise > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>IGST</span>
                <span className="font-mono">{formatINR(receipt.igst_total_paise)}</span>
              </div>
            )}

            {receipt.discount_paise > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="font-mono">-{formatINR(receipt.discount_paise)}</span>
              </div>
            )}

            {receipt.round_off_paise !== 0 && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>Round Off</span>
                <span className="font-mono">
                  {receipt.round_off_paise > 0 ? '+' : ''}{formatINR(Math.abs(receipt.round_off_paise))}
                </span>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-gray-900 font-mono">
                {formatINR(receipt.total_paise)}
              </span>
            </div>

            {/* Tax Summary */}
            {isTaxInvoice && totalTaxPaise > 0 && (
              <p className="text-[10px] text-gray-400 text-right">
                Includes {formatINR(totalTaxPaise)} in GST
              </p>
            )}
          </div>

          {/* ── Payment Info ── */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{PAYMENT_ICONS[receipt.payment_mode] ?? '💰'}</span>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Paid via</p>
                <p className="text-sm font-medium text-gray-700">
                  {PAYMENT_LABELS[receipt.payment_mode] ?? receipt.payment_mode}
                </p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="text-green-700 text-xs font-semibold">✓ Paid</span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">Thank you for your purchase!</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Powered by BharatGrowth · This is a computer-generated receipt
            </p>
          </div>
        </div>

        {/* ── Share / Print buttons (outside the card) ── */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium
                       hover:bg-gray-50 active:scale-95 transition-all"
          >
            🖨️ Print
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Receipt - ${receipt.invoice_number}`,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium
                       hover:bg-gray-50 active:scale-95 transition-all"
          >
            📤 Share
          </button>
        </div>
      </div>
    </div>
  );
}
