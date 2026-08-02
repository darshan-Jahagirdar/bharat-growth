import { getDashboardClient } from './dashboardClient';
import { formatISTDateISO, getISTDate, getMonthStart } from './dashboardDateRanges';
import type { GstReportRow } from './dashboardQueryTypes';

export async function exportGstReport(shopId: string): Promise<GstReportRow[]> {
  const client = getDashboardClient();
  const monthStart = getMonthStart();
  const ist = getISTDate();
  const monthEnd = `${formatISTDateISO(ist)}T23:59:59+05:30`;

  const { data: invoices, error } = await client
    .from('invoices')
    .select(`
      id,
      invoice_number,
      created_at,
      total_paise,
      payment_mode,
      customer_gstin,
      customers ( name, phone_number ),
      invoice_items (
        product_name,
        hsn_code,
        quantity,
        taxable_amount_paise,
        cgst_paise,
        sgst_paise,
        igst_paise,
        total_paise
      )
    `)
    .eq('shop_id', shopId)
    .eq('status', 'completed')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GST Export] Query error:', error.message);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  if (!invoices || invoices.length === 0) return [];

  const rows: GstReportRow[] = [];

  for (const inv of invoices) {
    const customer = inv.customers as unknown as {
      name: string | null;
      phone_number: string;
    } | null;

    const items = (inv.invoice_items ?? []) as unknown as Array<{
      product_name: string;
      hsn_code: string | null;
      quantity: number;
      taxable_amount_paise: number;
      cgst_paise: number;
      sgst_paise: number;
      igst_paise: number;
      total_paise: number;
    }>;

    const createdAt = new Date(inv.created_at);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(createdAt.getTime() + istOffset);
    const invoiceDate = `${String(istDate.getUTCDate()).padStart(2, '0')}/${String(istDate.getUTCMonth() + 1).padStart(2, '0')}/${istDate.getUTCFullYear()}`;

    if (items.length === 0) {
      rows.push({
        'Invoice No': inv.invoice_number ?? inv.id.slice(0, 8),
        'Invoice Date': invoiceDate,
        'Customer Name': customer?.name ?? 'Walk-in',
        'Customer Phone': customer?.phone_number ?? '',
        'Buyer GSTIN': inv.customer_gstin ?? '',
        'HSN/SAC': '',
        'Taxable Value (₹)': paiseToRupeeStr(inv.total_paise ?? 0),
        'CGST (₹)': '0.00',
        'SGST (₹)': '0.00',
        'IGST (₹)': '0.00',
        'Invoice Total (₹)': paiseToRupeeStr(inv.total_paise ?? 0),
        'Payment Mode': inv.payment_mode ?? 'cash',
      });
    } else {
      for (const item of items) {
        rows.push({
          'Invoice No': inv.invoice_number ?? inv.id.slice(0, 8),
          'Invoice Date': invoiceDate,
          'Customer Name': customer?.name ?? 'Walk-in',
          'Customer Phone': customer?.phone_number ?? '',
          'Buyer GSTIN': inv.customer_gstin ?? '',
          'HSN/SAC': item.hsn_code ?? '',
          'Taxable Value (₹)': paiseToRupeeStr(item.taxable_amount_paise ?? 0),
          'CGST (₹)': paiseToRupeeStr(item.cgst_paise ?? 0),
          'SGST (₹)': paiseToRupeeStr(item.sgst_paise ?? 0),
          'IGST (₹)': paiseToRupeeStr(item.igst_paise ?? 0),
          'Invoice Total (₹)': paiseToRupeeStr(item.total_paise ?? 0),
          'Payment Mode': inv.payment_mode ?? 'cash',
        });
      }
    }
  }

  return rows;
}

function paiseToRupeeStr(paise: number): string {
  return (paise / 100).toFixed(2);
}
