import { getBillingClient } from './billingClient';
import type { SaveInvoiceParams, SaveInvoiceResult } from './billingQueryTypes';

export async function saveInvoice(
  params: SaveInvoiceParams
): Promise<{ data: SaveInvoiceResult | null; error: string | null }> {
  const client = getBillingClient();

  const { data, error } = await client.rpc('save_invoice', {
    p_invoice: params.invoice,
    p_items: params.items,
    p_loyalty_entry: params.loyaltyEntry ?? null,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as SaveInvoiceResult, error: null };
}

export async function processCreditRepayment(
  shopId: string,
  customerId: string,
  amountPaise: number,
  notes: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (amountPaise <= 0) return { success: false, error: 'Amount must be greater than 0' };

  const client = getBillingClient();

  const { error } = await client.rpc('record_credit_repayment', {
    p_shop_id: shopId,
    p_customer_id: customerId,
    p_amount_paise: amountPaise,
    p_notes: notes,
  });

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}
