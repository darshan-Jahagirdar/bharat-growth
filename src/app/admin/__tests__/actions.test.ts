// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveAccessRequest,
  dismissAccessRequest,
} from '../actions';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  getPlatformAdminIdentity: vi.fn(),
  createAdminClient: vi.fn(),
  sendAccessApprovalEmail: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/access/platformAdmin', () => ({
  getPlatformAdminIdentity: mocks.getPlatformAdminIdentity,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/access/approvalEmail', () => ({
  sendAccessApprovalEmail: mocks.sendAccessApprovalEmail,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

function requestFormData() {
  const formData = new FormData();
  formData.set('requestId', REQUEST_ID);
  return formData;
}

describe('access request admin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformAdminIdentity.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      email: 'admin@example.test',
    });
    mocks.createAdminClient.mockReturnValue({
      from: () => ({ update: mocks.update }),
    });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      select: mocks.select,
    });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: REQUEST_ID,
        email: 'owner@example.test',
        full_name: 'Owner',
      },
      error: null,
    });
    mocks.sendAccessApprovalEmail.mockResolvedValue({ sent: true });
  });

  it('re-verifies the admin before approving and emails only after the transition', async () => {
    await approveAccessRequest(requestFormData());

    expect(mocks.getPlatformAdminIdentity).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'approved',
      reviewed_at: expect.any(String),
    });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, 'id', REQUEST_ID);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(mocks.sendAccessApprovalEmail).toHaveBeenCalledWith({
      email: 'owner@example.test',
      fullName: 'Owner',
    });
    expect(mocks.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendAccessApprovalEmail.mock.invocationCallOrder[0]
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('does not roll back approval when email delivery fails', async () => {
    mocks.sendAccessApprovalEmail.mockResolvedValueOnce({
      sent: false,
      failureKind: 'network',
    });

    await expect(
      approveAccessRequest(requestFormData())
    ).resolves.toBeUndefined();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('does not email a stale or replayed approval', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await approveAccessRequest(requestFormData());

    expect(mocks.sendAccessApprovalEmail).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('denies non-admin callers before creating a service-role client', async () => {
    mocks.getPlatformAdminIdentity.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
    });

    await expect(approveAccessRequest(requestFormData())).rejects.toThrow(
      'Platform admin authorization required'
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('dismisses pending requests without sending email', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { id: REQUEST_ID },
      error: null,
    });

    await dismissAccessRequest(requestFormData());

    expect(mocks.getPlatformAdminIdentity).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'dismissed',
      reviewed_at: expect.any(String),
    });
    expect(mocks.sendAccessApprovalEmail).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });
});
