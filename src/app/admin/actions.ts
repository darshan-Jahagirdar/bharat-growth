'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAccessApprovalEmail } from '@/lib/access/approvalEmail';
import { getPlatformAdminIdentity } from '@/lib/access/platformAdmin';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdminActionIdentity() {
  const identity = await getPlatformAdminIdentity();
  if (!identity.ok) {
    throw new Error('Platform admin authorization required');
  }
}

function requestIdFrom(formData: FormData): string {
  const requestId = formData.get('requestId');
  if (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) {
    throw new Error('Invalid access request');
  }
  return requestId;
}

export async function approveAccessRequest(formData: FormData): Promise<void> {
  await requireAdminActionIdentity();
  const requestId = requestIdFrom(formData);
  const admin = createAdminClient();
  const reviewedAt = new Date().toISOString();

  const { data: approvedRequest, error } = await admin
    .from('access_requests')
    .update({
      status: 'approved',
      reviewed_at: reviewedAt,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id, email, full_name')
    .maybeSingle();

  if (error) {
    throw new Error('Unable to approve access request');
  }

  // A stale/replayed action is a no-op. Only the pending->approved winner
  // sends, preventing duplicate notifications under retries or concurrency.
  if (!approvedRequest) {
    return;
  }

  // Approval is already committed. Email is a courtesy and cannot roll it
  // back; the helper logs configuration, network, and provider failures.
  await sendAccessApprovalEmail({
    email: approvedRequest.email,
    fullName: approvedRequest.full_name,
  });

  revalidatePath('/admin');
}

export async function dismissAccessRequest(formData: FormData): Promise<void> {
  await requireAdminActionIdentity();
  const requestId = requestIdFrom(formData);
  const admin = createAdminClient();

  const { data: dismissedRequest, error } = await admin
    .from('access_requests')
    .update({
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error('Unable to dismiss access request');
  }

  if (dismissedRequest) {
    revalidatePath('/admin');
  }
}
