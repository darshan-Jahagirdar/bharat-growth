import { getBillingClient } from './billingClient';

export async function fetchShopContext(shopId: string) {
  const client = getBillingClient();

  const { data, error } = await client
    .from('shops')
    .select('id, business_name, gst_type, state_code, business_type, gstin, city, upi_id')
    .eq('id', shopId)
    .single();

  if (error || !data) return null;
  return data;
}
