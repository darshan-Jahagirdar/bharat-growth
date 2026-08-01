// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';

const mocks = vi.hoisted(() => ({
  requireShopUser: vi.fn(),
  userRpc: vi.fn(),
  adminRpc: vi.fn(),
  adminFrom: vi.fn(),
  shopSingle: vi.fn(),
  customerSingle: vi.fn(),
  deleteClaim: vi.fn(),
  deleteEq: vi.fn(),
  sendVisitAcknowledgement: vi.fn(),
}));

vi.mock('@/lib/api/requireShopUser', () => ({
  requireShopUser: mocks.requireShopUser,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.adminRpc,
    from: mocks.adminFrom,
  }),
}));

vi.mock('@/lib/whatsapp/service', () => ({
  sendVisitAcknowledgement: mocks.sendVisitAcknowledgement,
}));

const SHOP_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const VISIT_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = '44444444-4444-4444-8444-444444444444';
const CLAIM_ID = '55555555-5555-4555-8555-555555555555';

function request(body: unknown) {
  return new NextRequest('https://example.test/api/visits', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function visitBody() {
  return {
    request_id: REQUEST_ID,
    phone_number: '9876543210',
    customer_name: 'Fixture Customer',
    tag_id: null,
    marketing_consent: true,
  };
}

function claimedAcknowledgement() {
  return {
    claimed: true,
    claim_id: CLAIM_ID,
    customer_id: CUSTOMER_ID,
    customer_name: 'Fixture Customer',
    customer_phone: '+919876543210',
    shop_name: 'Fixture Shop',
    points_awarded: 1,
    loyalty_balance: 8,
  };
}

describe('POST /api/visits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireShopUser.mockResolvedValue({
      ok: true,
      supabase: { rpc: mocks.userRpc },
      userId: 'user-id',
      shopId: SHOP_ID,
      fullName: 'Owner',
      userPhone: null,
      shopName: 'Fixture Shop',
      shopPhone: null,
      upiId: null,
    });
    mocks.userRpc.mockResolvedValue({
      data: {
        request_id: REQUEST_ID,
        customer_id: CUSTOMER_ID,
        visit_id: VISIT_ID,
        points_awarded: 1,
        loyalty_balance: 8,
        idempotent_replay: false,
      },
      error: null,
    });
    mocks.adminRpc.mockResolvedValue({
      data: claimedAcknowledgement(),
      error: null,
    });
    mocks.shopSingle.mockResolvedValue({
      data: { campaigns_approved: true },
      error: null,
    });
    mocks.customerSingle.mockResolvedValue({
      data: { dpdp_marketing_consent: true },
      error: null,
    });

    const deleteChain: {
      eq: typeof mocks.deleteEq;
      then: PromiseLike<{ error: null }>['then'];
    } = {
      eq: mocks.deleteEq,
      then: (resolve, reject) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    };
    mocks.deleteEq.mockReturnValue(deleteChain);
    mocks.deleteClaim.mockReturnValue(deleteChain);

    mocks.adminFrom.mockImplementation((table: string) => {
      if (table === 'visit_acknowledgement_claims') {
        return { delete: mocks.deleteClaim };
      }
      if (table === 'shops') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.shopSingle }),
          }),
        };
      }
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: mocks.customerSingle }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.sendVisitAcknowledgement.mockResolvedValue({
      sent: true,
      simulated: false,
    });
  });

  it('requires an authenticated active shop user', async () => {
    mocks.requireShopUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    });

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(401);
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it('rejects invalid request IDs before creating a visit', async () => {
    const response = await POST(request({
      ...visitBody(),
      request_id: 'not-a-uuid',
    }));

    expect(response.status).toBe(400);
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it('creates through the tenant RPC and sends from database-derived claim data', async () => {
    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(mocks.userRpc).toHaveBeenCalledWith('log_customer_visit', {
      p_shop_id: SHOP_ID,
      p_request_id: REQUEST_ID,
      p_phone_number: '9876543210',
      p_customer_name: 'Fixture Customer',
      p_tag_id: null,
      p_marketing_consent: true,
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      'claim_visit_acknowledgement',
      {
        p_shop_id: SHOP_ID,
        p_visit_id: VISIT_ID,
      }
    );
    expect(mocks.sendVisitAcknowledgement).toHaveBeenCalledWith(
      '+919876543210',
      'Fixture Customer',
      'Fixture Shop',
      1,
      8
    );

    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      visit_id: VISIT_ID,
      points_awarded: 1,
      loyalty_balance: 8,
      idempotent_replay: false,
      acknowledgement: 'sent',
    });
    expect(JSON.stringify(payload)).not.toContain('Fixture Customer');
    expect(JSON.stringify(payload)).not.toContain('9876543210');
  });

  it.each([
    ['campaign_approval_required', 'approval_required'],
    ['whatsapp_consent_required', 'consent_required'],
    ['already_claimed', 'already_processed'],
  ])('records visits but does not send when the claim reports %s', async (
    reason,
    expectedStatus
  ) => {
    mocks.adminRpc.mockResolvedValue({
      data: {
        claimed: false,
        reason,
        ...(reason === 'already_claimed' ? { claim_id: CLAIM_ID } : {}),
      },
      error: null,
    });

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      visit_id: VISIT_ID,
      acknowledgement: expectedStatus,
    });
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.sendVisitAcknowledgement).not.toHaveBeenCalled();
  });

  it.each([
    ['configuration'],
    ['rejected'],
  ] as const)('releases a claim after a definite %s failure', async (failureKind) => {
    mocks.sendVisitAcknowledgement.mockResolvedValue({
      sent: false,
      simulated: false,
      error: 'not accepted',
      failureKind,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      acknowledgement: 'failed',
    });
    expect(mocks.deleteClaim).toHaveBeenCalledOnce();
    expect(mocks.deleteEq).toHaveBeenCalledWith('id', CLAIM_ID);
    expect(mocks.deleteEq).toHaveBeenCalledWith('shop_id', SHOP_ID);
    expect(mocks.deleteEq).toHaveBeenCalledWith('visit_id', VISIT_ID);
  });

  it('retains the claim after an ambiguous network failure', async () => {
    mocks.sendVisitAcknowledgement.mockResolvedValue({
      sent: false,
      simulated: false,
      error: 'connection lost',
      failureKind: 'network',
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      acknowledgement: 'failed',
    });
    expect(mocks.deleteClaim).not.toHaveBeenCalled();
  });

  it('releases without sending if approval is revoked after the claim', async () => {
    mocks.shopSingle.mockResolvedValue({
      data: { campaigns_approved: false },
      error: null,
    });

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      acknowledgement: 'approval_required',
    });
    expect(mocks.deleteClaim).toHaveBeenCalledOnce();
    expect(mocks.sendVisitAcknowledgement).not.toHaveBeenCalled();
  });

  it('releases without sending if consent is withdrawn after the claim', async () => {
    mocks.customerSingle.mockResolvedValue({
      data: { dpdp_marketing_consent: false },
      error: null,
    });

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      acknowledgement: 'consent_required',
    });
    expect(mocks.deleteClaim).toHaveBeenCalledOnce();
    expect(mocks.sendVisitAcknowledgement).not.toHaveBeenCalled();
  });

  it('retains successful simulation claims exactly like other send paths', async () => {
    mocks.sendVisitAcknowledgement.mockResolvedValue({
      sent: false,
      simulated: true,
    });

    const response = await POST(request(visitBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      acknowledgement: 'simulated',
    });
    expect(mocks.deleteClaim).not.toHaveBeenCalled();
  });
});
