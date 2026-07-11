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

// PostgREST `.or()` expressions are a query language, so raw punctuation from
// user input must not be interpolated into the expression.
function sanitizeSearchTerm(query: string): string {
  return query
    .replace(/[,()%"\\]/g, ' ')
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Customer Search (by phone number or name) ──

export async function searchCustomers(
  query: string,
  shopId: string
): Promise<SelectedCustomer[]> {
  const client = getClient();
  const searchTerm = sanitizeSearchTerm(query);

  if (!searchTerm) return [];

  // Single query — no loyalty join needed for the search dropdown.
  // Loyalty points are lazy-loaded when a customer is actually selected.
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
    loyaltyPoints: 0, // Lazy-loaded on selection via refreshCustomerWithLoyalty()
    gstin: c.gstin,
    segment: c.segment,
    creditBalancePaise: c.credit_balance_paise ?? 0,
    photoUrl: c.photo_url ?? null,
  }));
}

// ── Fetch loyalty points for a single selected customer ──

export async function fetchCustomerLoyalty(
  customerId: string,
  shopId: string
): Promise<number> {
  const client = getClient();

  const { data } = await client
    .from('loyalty_ledger')
    .select('running_balance')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.running_balance ?? 0;
}

// ── Product Search (by name, SKU, HSN, or barcode) ──

export async function searchProducts(
  query: string,
  shopId: string
): Promise<Product[]> {
  const client = getClient();
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

// ── Process Credit Repayment ──

export async function processCreditRepayment(
  shopId: string,
  customerId: string,
  amountPaise: number,
  notes: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (amountPaise <= 0) return { success: false, error: 'Amount must be greater than 0' };

  const client = getClient();

  const { error } = await client.rpc('record_credit_repayment', {
    p_shop_id: shopId,
    p_customer_id: customerId,
    p_amount_paise: amountPaise,
    p_notes: notes,
  });

  if (error) return { success: false, error: error.message };

  return { success: true, error: null };
}

// ── Refresh Customer Data (after repayment or photo upload) ──

export async function refreshCustomer(
  shopId: string,
  customerId: string
): Promise<SelectedCustomer | null> {
  const client = getClient();

  const { data: c, error } = await client
    .from('customers')
    .select('id, phone_number, name, gstin, segment, credit_balance_paise, photo_url')
    .eq('id', customerId)
    .eq('shop_id', shopId)
    .single();

  if (error || !c) return null;

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
    creditBalancePaise: c.credit_balance_paise ?? 0,
    photoUrl: c.photo_url ?? null,
  };
}

// ── Upload Customer Photo ──

const CUSTOMER_IMAGE_BUCKET = 'customer-images';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

function imageExtFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadCustomerImage(
  file: File,
  shopId: string,
  customerId: string
): Promise<{ publicUrl: string | null; error: string | null }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { publicUrl: null, error: 'Only JPG, PNG, or WebP images allowed.' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { publicUrl: null, error: 'Image must be under 5 MB.' };
  }

  const client = getClient();
  const ext = imageExtFromMime(file.type);
  const path = `${shopId}/${customerId}.${ext}`;

  const { error: uploadErr } = await client.storage
    .from(CUSTOMER_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });

  if (uploadErr) {
    return { publicUrl: null, error: `Upload failed: ${uploadErr.message}` };
  }

  const { data } = client.storage.from(CUSTOMER_IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // Save URL to customer record
  const { error: updateErr } = await client
    .from('customers')
    .update({ photo_url: publicUrl })
    .eq('id', customerId)
    .eq('shop_id', shopId);

  if (updateErr) {
    return { publicUrl: null, error: `DB update failed: ${updateErr.message}` };
  }

  return { publicUrl, error: null };
}

// ── Create New Customer ──

export async function createNewCustomer(
  shopId: string,
  name: string,
  phoneNumber: string,
  photoFile?: File | null,
  marketingConsent: boolean = false
): Promise<{ customer: SelectedCustomer | null; error: string | null }> {
  const client = getClient();

  // Upload photo first if provided
  let photoUrl: string | null = null;
  const tempId = crypto.randomUUID(); // pre-generate for photo path

  if (photoFile) {
    const uploadResult = await uploadCustomerImage(photoFile, shopId, tempId);
    if (uploadResult.error) {
      // Non-fatal — continue without photo
      console.warn('[Billing] Photo upload failed:', uploadResult.error);
    } else {
      photoUrl = uploadResult.publicUrl;
    }
  }

  const { data, error } = await client
    .from('customers')
    .insert({
      id: tempId,
      shop_id: shopId,
      name,
      phone_number: phoneNumber,
      segment: 'new',
      total_spent_paise: 0,
      visit_count: 0,
      credit_balance_paise: 0,
      photo_url: photoUrl,
      dpdp_marketing_consent: marketingConsent,
      consent_collected_at: marketingConsent ? new Date().toISOString() : null,
    })
    .select('id, phone_number, name, gstin, segment, credit_balance_paise, photo_url')
    .single();

  if (error) {
    return { customer: null, error: `Failed to create customer: ${error.message}` };
  }

  // DPDP audit trail — non-fatal so the billing flow is never blocked
  if (marketingConsent) {
    const { data: auth } = await client.auth.getUser();
    const { error: consentErr } = await client.from('consent_logs').insert({
      shop_id: shopId,
      customer_id: data.id,
      purpose: 'whatsapp_marketing',
      status: 'granted',
      consent_method: 'verbal_recorded',
      collected_by: auth.user?.id ?? null,
      metadata: { source: 'pos_create_customer' },
    });
    if (consentErr) {
      console.warn('[Billing] Consent log insert failed:', consentErr.message);
    }
  }

  return {
    customer: {
      id: data.id,
      phoneNumber: data.phone_number,
      name: data.name,
      loyaltyPoints: 0,
      gstin: data.gstin,
      segment: data.segment,
      creditBalancePaise: data.credit_balance_paise ?? 0,
      photoUrl: data.photo_url ?? null,
    },
    error: null,
  };
}

// ── Fetch Shop Context ──

export async function fetchShopContext(shopId: string) {
  const client = getClient();

  const { data, error } = await client
    .from('shops')
    .select('id, business_name, gst_type, state_code, business_type, gstin, city, upi_id')
    .eq('id', shopId)
    .single();

  if (error || !data) return null;
  return data;
}
