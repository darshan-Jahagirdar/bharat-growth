import { getBillingClient } from './billingClient';

export interface VisitTag {
  id: string;
  name: string;
}

export interface LogCustomerVisitInput {
  request_id: string;
  phone_number: string;
  customer_name: string | null;
  tag_id: string | null;
  marketing_consent: boolean;
}

export async function fetchVisitTags(shopId: string): Promise<VisitTag[]> {
  const client = getBillingClient();
  const { data, error } = await client
    .from('tags')
    .select('id, name')
    .eq('shop_id', shopId)
    .order('name');

  if (error) {
    throw new Error(`Failed to load interest tags: ${error.message}`);
  }

  return (data ?? []) as VisitTag[];
}

export async function logCustomerVisit(
  input: LogCustomerVisitInput
): Promise<void> {
  const response = await fetch('/api/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = await response.json().catch(() => null) as {
    success?: boolean;
    error?: string;
    acknowledgement?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error ?? 'Could not record the visit. Please try again.');
  }

  if (body?.success !== true) {
    throw new Error('The visit response was invalid. Please try again.');
  }

  if (body.acknowledgement === 'failed') {
    throw new Error(
      'Visit recorded, but the WhatsApp acknowledgement could not be sent. Retry is safe and will not add another point.'
    );
  }
}
