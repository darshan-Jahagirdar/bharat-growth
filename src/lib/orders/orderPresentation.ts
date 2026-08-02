import { formatINR } from '@/lib/types/database';
import type { PurchaseOrderRow, SalesOrderRow } from './orderQueries';

export type OrdersTab = 'sales' | 'purchase';

export interface OrderConversionTarget {
  type: 'so' | 'po';
  orderId: string;
  orderNumber: string;
}

export interface OrdersToast {
  message: string;
  type: 'success' | 'error';
}

export const SO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  reserved: { label: 'Reserved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export const PO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit', label: 'Credit (Udhaar)' },
  { value: 'card', label: 'Card' },
];

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function formatOrderDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isActionableOrder(status: string): boolean {
  return status !== 'fulfilled' && status !== 'cancelled';
}

export function buildSOWhatsAppUrl(
  so: SalesOrderRow,
  shopName: string,
  shopId: string
): string {
  const phone = so.customer_phone ? normalizePhone(so.customer_phone) : '';
  const total = formatINR(so.total_amount_paise);
  const name = so.customer_name ?? 'Customer';
  const date = formatOrderDate(so.created_at);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const storefrontUrl = `${origin}/store/${shopId}`;

  const itemLines = so.items
    .map((item) => {
      const productName = item.product_name ?? 'Item';
      const lineTotal = formatINR(
        item.agreed_price_paise * Math.round(item.quantity)
      );
      return `${productName} x ${item.quantity} = ${lineTotal}`;
    })
    .join('\n');

  const message = [
    `*RESERVATION CONFIRMED - ${shopName}*`,
    '',
    `Order No: ${so.so_number}`,
    `Customer: ${name}`,
    `Date: ${date}`,
    '-------------------',
    itemLines,
    '-------------------',
    `*Total: ${total}*`,
    '',
    `Thank you for choosing us! View our store: ${storefrontUrl}`,
  ].join('\n');

  const text = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export function buildPOWhatsAppUrl(
  po: PurchaseOrderRow,
  shopName: string
): string {
  const total = formatINR(po.total_amount_paise);
  const date = formatOrderDate(po.created_at);
  const itemLines = po.items
    .map((item) => `${item.product_name ?? 'Item'} x ${item.quantity}`)
    .join('\n');

  const message = [
    `*PURCHASE ORDER - ${shopName}*`,
    '',
    `PO No: ${po.po_number}`,
    `Supplier: ${po.supplier_name}`,
    `Date: ${date}`,
    '-------------------',
    itemLines,
    '-------------------',
    `*Total Estimated: ${total}*`,
    '',
    'Please confirm the availability of these items.',
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
