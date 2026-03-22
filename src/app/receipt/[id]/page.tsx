// =============================================================================
// BharatGrowth — Thermal Receipt Page (80mm printer)
// Route: /receipt/[id]
// Strict 80mm thermal formatting: simple table layout, no CSS grid
// =============================================================================

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/types/database';
import { notFound } from 'next/navigation';

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit: string;
  unit_price_paise: number;
  gst_rate_percent: number;
  total_paise: number;
}

interface ReceiptInvoice {
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
  shop: {
    business_name: string;
    gstin: string | null;
    address_line_1: string | null;
    city: string | null;
    state_code: string;
    phone: string | null;
  };
  items: ReceiptItem[];
}

async function getInvoice(id: string): Promise<ReceiptInvoice | null> {
  const supabase = await createServerSupabaseClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, document_type,
      customer_name, customer_phone, customer_gstin,
      subtotal_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
      discount_paise, round_off_paise, total_paise,
      payment_mode, is_inter_state,
      shop:shops!inner(business_name, gstin, address_line_1, city, state_code, phone)
    `)
    .eq('id', id)
    .single();

  if (error || !invoice) return null;

  const { data: items } = await supabase
    .from('invoice_items')
    .select('product_name, quantity, unit, unit_price_paise, gst_rate_percent, total_paise')
    .eq('invoice_id', id)
    .order('created_at');

  // Supabase returns joined single row as object, array for multiple
  const shop = Array.isArray(invoice.shop) ? invoice.shop[0] : invoice.shop;

  return {
    ...invoice,
    shop,
    items: (items ?? []) as ReceiptItem[],
  } as ReceiptInvoice;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
  split: 'Split',
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  const isTaxInvoice = invoice.document_type === 'tax_invoice';
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.bharatgrowth.in'}/receipt/${invoice.id}`;

  return (
    <>
      {/* Print-only styles — inline for thermal printer compatibility */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: 80mm auto;
                margin: 2mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            @media screen {
              body { background: #f5f5f5; }
              .receipt-wrapper { max-width: 80mm; margin: 20px auto; }
            }
          `,
        }}
      />

      {/* Auto-print trigger (used when loaded in iframe) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if (window.self !== window.top) {
              window.onload = function() { window.print(); };
            }
          `,
        }}
      />

      <div className="receipt-wrapper">
        <div
          style={{
            width: '80mm',
            fontFamily: 'monospace, Courier New, Courier',
            fontSize: '12px',
            lineHeight: '1.4',
            color: '#000',
            background: '#fff',
            padding: '3mm',
          }}
        >
          {/* ── Shop Header ── */}
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{invoice.shop.business_name}</div>
            {invoice.shop.address_line_1 && (
              <div style={{ fontSize: '10px' }}>{invoice.shop.address_line_1}</div>
            )}
            {invoice.shop.city && (
              <div style={{ fontSize: '10px' }}>{invoice.shop.city}</div>
            )}
            {invoice.shop.phone && (
              <div style={{ fontSize: '10px' }}>Ph: {invoice.shop.phone}</div>
            )}
            {invoice.shop.gstin && (
              <div style={{ fontSize: '10px' }}>GSTIN: {invoice.shop.gstin}</div>
            )}
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
              {isTaxInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
            </div>
          </div>

          {/* ── Invoice Meta ── */}
          <div style={{ fontSize: '10px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>No: {invoice.invoice_number}</span>
              <span>{formatDate(invoice.invoice_date)}</span>
            </div>
            {invoice.customer_name && (
              <div>Customer: {invoice.customer_name}</div>
            )}
            {invoice.customer_phone && (
              <div>Phone: {invoice.customer_phone}</div>
            )}
            {invoice.customer_gstin && (
              <div>GSTIN: {invoice.customer_gstin}</div>
            )}
          </div>

          {/* ── Separator ── */}
          <div style={{ borderBottom: '1px dashed #000', marginBottom: '4px' }} />

          {/* ── Line Items (simple table — no CSS grid) ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '1px 0' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '1px 0', width: '40px' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '1px 0', width: '50px' }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '1px 0', width: '55px' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '2px 0', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product_name}
                    {isTaxInvoice && item.gst_rate_percent > 0 && (
                      <span style={{ fontSize: '8px', color: '#666' }}> ({item.gst_rate_percent}%)</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>
                    {item.quantity}{item.unit !== 'piece' ? ` ${item.unit}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>
                    {(item.unit_price_paise / 100).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>
                    {(item.total_paise / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Separator ── */}
          <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />

          {/* ── Totals ── */}
          <div style={{ fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>{(invoice.subtotal_paise / 100).toFixed(2)}</span>
            </div>

            {isTaxInvoice && !invoice.is_inter_state && invoice.cgst_total_paise > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CGST</span>
                  <span>{(invoice.cgst_total_paise / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SGST</span>
                  <span>{(invoice.sgst_total_paise / 100).toFixed(2)}</span>
                </div>
              </>
            )}

            {isTaxInvoice && invoice.is_inter_state && invoice.igst_total_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IGST</span>
                <span>{(invoice.igst_total_paise / 100).toFixed(2)}</span>
              </div>
            )}

            {invoice.discount_paise > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount</span>
                <span>-{(invoice.discount_paise / 100).toFixed(2)}</span>
              </div>
            )}

            {invoice.round_off_paise !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Round Off</span>
                <span>{(invoice.round_off_paise / 100).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* ── Grand Total ── */}
          <div
            style={{
              borderTop: '2px solid #000',
              borderBottom: '2px solid #000',
              margin: '4px 0',
              padding: '3px 0',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            <span>TOTAL</span>
            <span>{formatINR(invoice.total_paise)}</span>
          </div>

          {/* ── Payment Mode ── */}
          <div style={{ fontSize: '10px', textAlign: 'center', marginBottom: '4px' }}>
            Paid via: {PAYMENT_LABELS[invoice.payment_mode] ?? invoice.payment_mode}
          </div>

          {/* ── QR Code (link to digital bill) ── */}
          <div style={{ textAlign: 'center', margin: '6px 0' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`}
              alt="Digital Bill QR"
              width={120}
              height={120}
              style={{ imageRendering: 'pixelated' }}
            />
            <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>
              Scan for digital bill
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '9px',
              borderTop: '1px dashed #000',
              paddingTop: '4px',
              color: '#666',
            }}
          >
            <div>Thank you for your purchase!</div>
            <div>Powered by BharatGrowth</div>
          </div>
        </div>
      </div>

      {/* ── Screen-only: Print button ── */}
      <div className="no-print" style={{ textAlign: 'center', margin: '16px' }}>
        <button
          onClick={() => (window as typeof window).print()}
          style={{
            padding: '8px 24px',
            fontSize: '14px',
            background: '#ea580c',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Print Receipt
        </button>
      </div>
    </>
  );
}
