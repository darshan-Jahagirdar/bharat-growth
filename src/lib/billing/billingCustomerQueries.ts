import type { SelectedCustomer } from './useBillingStore';
import { getBillingClient } from './billingClient';

const CUSTOMER_IMAGE_BUCKET = 'customer-images';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function imageExtFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function refreshCustomer(
  shopId: string,
  customerId: string
): Promise<SelectedCustomer | null> {
  const client = getBillingClient();

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

  const client = getBillingClient();
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

export async function createNewCustomer(
  shopId: string,
  name: string,
  phoneNumber: string,
  photoFile?: File | null,
  marketingConsent: boolean = false
): Promise<{ customer: SelectedCustomer | null; error: string | null }> {
  const client = getBillingClient();

  let photoUrl: string | null = null;
  const tempId = crypto.randomUUID();

  if (photoFile) {
    const uploadResult = await uploadCustomerImage(photoFile, shopId, tempId);
    if (uploadResult.error) {
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
