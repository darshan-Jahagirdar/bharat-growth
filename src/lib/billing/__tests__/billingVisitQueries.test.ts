import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, expectQueryCalls } from '@/test/supabaseQueryMock';
import {
  fetchVisitTags,
  logCustomerVisit,
  type LogCustomerVisitInput,
} from '../billingVisitQueries';

const mocks = vi.hoisted(() => ({
  getBillingClient: vi.fn(),
}));

vi.mock('../billingClient', () => ({
  getBillingClient: mocks.getBillingClient,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.getBillingClient.mockReset();
});

describe('billing visit queries', () => {
  it('loads only the authenticated shop facade tags in name order', async () => {
    const query = createQueryBuilder({
      data: [{ id: 'tag-1', name: 'Tyres' }],
      error: null,
    });
    const client = { from: vi.fn(() => query) };
    mocks.getBillingClient.mockReturnValue(client);

    await expect(fetchVisitTags('shop-1')).resolves.toEqual([
      { id: 'tag-1', name: 'Tyres' },
    ]);
    expect(client.from).toHaveBeenCalledWith('tags');
    expect(expectQueryCalls(query)).toEqual([
      { method: 'select', args: ['id, name'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'order', args: ['name'] },
    ]);
  });

  it('posts the narrow visit contract without bill data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, acknowledgement: 'simulated' }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const input: LogCustomerVisitInput = {
      request_id: '11111111-1111-4111-8111-111111111111',
      phone_number: '+919876543210',
      customer_name: 'Test Customer',
      tag_id: '22222222-2222-4222-8222-222222222222',
      marketing_consent: true,
    };

    await logCustomerVisit(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('amount');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('items');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('customer_id');
  });

  it('keeps the same request retryable when the visit succeeded but acknowledgement failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, acknowledgement: 'failed' }),
          { status: 200 }
        )
      )
    );

    await expect(
      logCustomerVisit({
        request_id: '11111111-1111-4111-8111-111111111111',
        phone_number: '+919876543210',
        customer_name: null,
        tag_id: null,
        marketing_consent: false,
      })
    ).rejects.toThrow(
      'Visit recorded, but the WhatsApp acknowledgement could not be sent. Retry is safe and will not add another point.'
    );
  });
});
