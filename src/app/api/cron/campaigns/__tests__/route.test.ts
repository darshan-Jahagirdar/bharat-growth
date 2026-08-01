// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  messageLogInsert: vi.fn(),
  messageLogSingle: vi.fn(),
  customerSingle: vi.fn(),
  sendCampaignMessage: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

vi.mock('@/lib/whatsapp/service', () => ({
  sendCampaignMessage: mocks.sendCampaignMessage,
}));

const SHOP_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const INVOICE_ID = '33333333-3333-4333-8333-333333333333';
const VISIT_ID = '44444444-4444-4444-8444-444444444444';
const RULE_ID = '55555555-5555-4555-8555-555555555555';

function campaignMatch(
  source: { invoice_id: string | null; visit_id: string | null }
) {
  return {
    shop_id: SHOP_ID,
    shop_name: 'Fixture Shop',
    customer_id: CUSTOMER_ID,
    customer_name: 'Fixture Customer',
    customer_phone: '919876543210',
    ...source,
    rule_id: RULE_ID,
    rule_name: 'Bring Back',
    tag_name: 'Tyres',
    template_key: 'PROMO',
    custom_variable: 'Come back soon',
  };
}

function authorizedRequest() {
  return new Request('https://example.test/api/cron/campaigns', {
    headers: { authorization: 'Bearer test-cron-secret' },
  });
}

describe('campaign cron source claims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';

    mocks.messageLogSingle.mockResolvedValue({
      data: { id: 'claim-id' },
      error: null,
    });
    mocks.customerSingle.mockResolvedValue({
      data: { dpdp_marketing_consent: true },
      error: null,
    });
    mocks.sendCampaignMessage.mockResolvedValue({
      sent: true,
      simulated: false,
    });

    mocks.messageLogInsert.mockReturnValue({
      select: () => ({ single: mocks.messageLogSingle }),
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'message_logs') {
        return { insert: mocks.messageLogInsert };
      }

      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({ single: mocks.customerSingle }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it.each([
    {
      sourceName: 'invoice',
      invoice_id: INVOICE_ID,
      visit_id: null,
    },
    {
      sourceName: 'visit',
      invoice_id: null,
      visit_id: VISIT_ID,
    },
  ])(
    'claims and sends a $sourceName-sourced match',
    async ({ invoice_id, visit_id }) => {
      mocks.rpc.mockResolvedValue({
        data: [campaignMatch({ invoice_id, visit_id })],
        error: null,
      });

      const response = await GET(authorizedRequest());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        processed: 1,
        sent: 1,
        skipped: 0,
        errors: 0,
      });
      expect(mocks.messageLogInsert).toHaveBeenCalledWith({
        shop_id: SHOP_ID,
        customer_id: CUSTOMER_ID,
        invoice_id,
        visit_id,
        rule_id: RULE_ID,
        sent_at: expect.any(String),
      });
      expect(mocks.sendCampaignMessage).toHaveBeenCalledOnce();
    }
  );

  it.each([
    {
      sourceName: 'neither',
      invoice_id: null,
      visit_id: null,
    },
    {
      sourceName: 'both',
      invoice_id: INVOICE_ID,
      visit_id: VISIT_ID,
    },
  ])(
    'rejects a match with $sourceName source IDs before claiming',
    async ({ invoice_id, visit_id }) => {
      mocks.rpc.mockResolvedValue({
        data: [campaignMatch({ invoice_id, visit_id })],
        error: null,
      });

      const response = await GET(authorizedRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Unexpected match shape from RPC',
      });
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.messageLogInsert).not.toHaveBeenCalled();
      expect(mocks.sendCampaignMessage).not.toHaveBeenCalled();
    }
  );
});
