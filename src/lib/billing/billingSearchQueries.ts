import type { Product } from '@/lib/types/database';
import type { SelectedCustomer } from './useBillingStore';
import { getBillingClient } from './billingClient';

// PostgREST `.or()` expressions are a query language, so raw punctuation from
// user input must not be interpolated into the expression.
function sanitizeSearchTerm(query: string): string {
  return query
    .replace(/[,()%"\\]/g, ' ')
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchCustomers(
  query: string,
  shopId: string
): Promise<SelectedCustomer[]> {
  const client = getBillingClient();
  const searchTerm = sanitizeSearchTerm(query);

  if (!searchTerm) return [];

  const { data, error } = await client
    .from('customers')
    .select('id, phone_number, name, gstin, segment, total_spent_paise, visit_count, credit_balance_paise, photo_url')
    .eq('shop_id', shopId)
    .or(`phone_number.ilike.${searchTerm}%,name.ilike.${searchTerm}%`)
    .limit(5);

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    phoneNumber: c.phone_number,
    name: c.name,
    loyaltyPoints: 0,
    gstin: c.gstin,
    segment: c.segment,
    creditBalancePaise: c.credit_balance_paise ?? 0,
    photoUrl: c.photo_url ?? null,
  }));
}

export async function fetchCustomerLoyalty(
  customerId: string,
  shopId: string
): Promise<number> {
  const client = getBillingClient();

  const { data } = await client
    .from('loyalty_ledger')
    .select('running_balance')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.running_balance ?? 0;
}

export async function searchProducts(
  query: string,
  shopId: string
): Promise<Product[]> {
  const client = getBillingClient();
  const searchTerm = sanitizeSearchTerm(query);

  if (!searchTerm) return [];

  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,hsn_code.ilike.%${searchTerm}%,barcode.eq.${searchTerm}`)
    .order('name')
    .limit(8);

  if (error || !data) return [];
  return data as Product[];
}

export async function lookupBarcode(
  barcode: string,
  shopId: string
): Promise<Product | null> {
  const client = getBillingClient();

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
