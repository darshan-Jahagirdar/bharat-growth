// =============================================================================
// BharatGrowth — Billing Page Supabase Queries
// Replaces mockData.ts with real database queries
// =============================================================================

import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types/database';
import type { SelectedCustomer } from './useBillingStore';

// ── Singleton client for billing page ──

let supabase: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabase) supabase = createClient();
  return supabase;
}

// ── Customer Search (by phone number or name) ──

export async function searchCustomers(
  query: string,
  shopId: string
): Promise<SelectedCustomer[]> {
  const client = getClient();

  // Search by phone or name (case-insensitive)
  const { data, error } = await client
    .from('customers')
    .select('id, phone_number, name, gstin, segment, total_spent_paise, visit_count')
    .eq('shop_id', shopId)
    .or(`phone_number.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(5);

  if (error || !data) return [];

  // Fetch latest loyalty balance for each customer
  const results: SelectedCustomer[] = await Promise.all(
    data.map(async (c) => {
      const { data: loyaltyData } = await client
        .from('loyalty_ledger')
        .select('running_balance')
        .eq('shop_id', shopId)
        .eq('customer_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      return {
        id: c.id,
        phoneNumber: c.phone_number,
        name: c.name,
        loyaltyPoints: loyaltyData?.[0]?.running_balance ?? 0,
        gstin: c.gstin,
        segment: c.segment,
      };
    })
  );

  return results;
}

// ── Product Search (by name, SKU, HSN, or barcode) ──

export async function searchProducts(
  query: string,
  shopId: string
): Promise<Product[]> {
  const client = getClient();

  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%,hsn_code.ilike.%${query}%,barcode.eq.${query}`)
    .order('name')
    .limit(8);

  if (error || !data) return [];
  return data as Product[];
}

// ── Product Lookup by Barcode (for USB scanner) ──

export async function lookupBarcode(
  barcode: string,
  shopId: string
): Promise<Product | null> {
  const client = getClient();

  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('barcode', barcode)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as Product;
}

// ── Save Invoice (atomic RPC call) ──

export interface SaveInvoiceParams {
  invoice: {
    shop_id: string;
    invoice_date: string;
    invoice_type: string;
    document_type: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_gstin: string | null;
    billing_state_code: string;
    is_inter_state: boolean;
    subtotal_paise: number;
    cgst_total_paise: number;
    sgst_total_paise: number;
    igst_total_paise: number;
    discount_paise: number;
    round_off_paise: number;
    total_paise: number;
    payment_mode: string;
    payment_reference?: string | null;
    created_by: string | null;
  };
  items: Array<{
    product_id: string | null;
    product_name: string;
    hsn_code: string;
    quantity: number;
    unit: string;
    unit_price_paise: number;
    discount_paise: number;
    taxable_amount_paise: number;
    gst_rate_percent: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    total_paise: number;
    batch_number?: string | null;
  }>;
  loyaltyEntry?: {
    customer_id: string;
    entry_type: string;
    points: number;
    running_balance: number;
    description?: string;
  } | null;
}

export interface SaveInvoiceResult {
  invoice_id: string;
  invoice_number: string;
  invoice_sequence: number;
  financial_year: string;
  total_paise: number;
}

export async function saveInvoice(
  params: SaveInvoiceParams
): Promise<{ data: SaveInvoiceResult | null; error: string | null }> {
  const client = getClient();

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

// ── Fetch Shop Context ──

export async function fetchShopContext(shopId: string) {
  const client = getClient();

  const { data, error } = await client
    .from('shops')
    .select('id, business_name, gst_type, state_code, business_type, gstin, city')
    .eq('id', shopId)
    .single();

  if (error || !data) return null;
  return data;
}
