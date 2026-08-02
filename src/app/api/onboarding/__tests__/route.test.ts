// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';

const mocks = vi.hoisted(() => ({
  adminClient: {
    from: vi.fn(),
  },
  getUser: vi.fn(),
  seedDefaultCampaigns: vi.fn(),
  shopInsert: vi.fn(),
  userInsert: vi.fn(),
  existingUserMaybeSingle: vi.fn(),
  accessRequestMaybeSingle: vi.fn(),
  shopSingle: vi.fn(),
  userSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.adminClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  }),
}));

vi.mock('@/lib/campaigns/seedDefaults', () => ({
  seedDefaultCampaigns: mocks.seedDefaultCampaigns,
}));

describe('onboarding business types', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          phone: null,
          email: 'wave-a-grocery@example.test',
          user_metadata: { full_name: 'Wave A Owner' },
        },
      },
      error: null,
    });
    mocks.existingUserMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.accessRequestMaybeSingle.mockResolvedValue({
      data: { status: 'approved' },
      error: null,
    });
    mocks.shopSingle.mockResolvedValue({ data: { id: 'shop-grocery' }, error: null });
    mocks.userSingle.mockResolvedValue({
      data: { id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    });
    mocks.seedDefaultCampaigns.mockResolvedValue({ tagsCreated: 7, rulesCreated: 7 });

    mocks.shopInsert.mockReturnValue({
      select: () => ({ single: mocks.shopSingle }),
    });
    mocks.userInsert.mockReturnValue({
      select: () => ({ single: mocks.userSingle }),
    });

    mocks.adminClient.from.mockImplementation((table: string) => {
      if (table === 'shops') {
        return { insert: mocks.shopInsert };
      }

      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.existingUserMaybeSingle }),
          }),
          insert: mocks.userInsert,
        };
      }

      if (table === 'access_requests') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.accessRequestMaybeSingle }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('creates a valid grocery shop and seeds the grocery defaults', async () => {
    const response = await POST(
      new NextRequest('https://staging.example.test/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Wave A Grocery',
          business_type: 'grocery',
          city: 'Pune',
          state_code: '27',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      shop_id: 'shop-grocery',
    });
    expect(mocks.shopInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Wave A Grocery',
        business_type: 'grocery',
      })
    );
    expect(mocks.shopInsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        campaigns_approved: expect.anything(),
      })
    );
    expect(mocks.seedDefaultCampaigns).toHaveBeenCalledWith(
      mocks.adminClient,
      'shop-grocery',
      'grocery'
    );
  });

  it.each([
    ['missing', null],
    ['pending', { status: 'pending' }],
    ['dismissed', { status: 'dismissed' }],
  ])('rejects a %s access request before creating a shop', async (_, data) => {
    mocks.accessRequestMaybeSingle.mockResolvedValueOnce({
      data,
      error: null,
    });

    const response = await POST(
      new NextRequest('https://staging.example.test/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Blocked Store',
          business_type: 'general',
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Access approval required',
    });
    expect(mocks.shopInsert).not.toHaveBeenCalled();
    expect(mocks.userInsert).not.toHaveBeenCalled();
  });

  it('fails closed when approval status cannot be verified', async () => {
    mocks.accessRequestMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await POST(
      new NextRequest('https://staging.example.test/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Blocked Store',
          business_type: 'general',
        }),
      })
    );

    expect(response.status).toBe(503);
    expect(mocks.shopInsert).not.toHaveBeenCalled();
  });

  it('keeps already-onboarded users grandfathered without an approval lookup', async () => {
    mocks.existingUserMaybeSingle.mockResolvedValueOnce({
      data: { id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    });

    const response = await POST(
      new NextRequest('https://staging.example.test/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Existing Store',
          business_type: 'general',
        }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.accessRequestMaybeSingle).not.toHaveBeenCalled();
    expect(mocks.shopInsert).not.toHaveBeenCalled();
  });
});
