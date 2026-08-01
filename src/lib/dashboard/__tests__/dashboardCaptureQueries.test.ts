import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryBuilder,
  expectQueryCalls,
  type QueryBuilder,
} from '@/test/supabaseQueryMock';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

function queuedClient(queues: Record<string, QueryBuilder[]>) {
  return {
    from: vi.fn((table: string) => {
      const builder = queues[table]?.shift();
      if (!builder) throw new Error(`Missing query builder for ${table}`);
      return builder;
    }),
  };
}

describe('dashboard capture metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createClient.mockReset();
  });

  it('counts capture events and the identified share within the selected IST period', async () => {
    const invoicesQuery = createQueryBuilder({
      data: [
        { customer_id: 'customer-a' },
        { customer_id: null },
        { customer_id: 'customer-a' },
        { customer_id: 'customer-b' },
      ],
      error: null,
    });
    const visitsQuery = createQueryBuilder({
      data: [{ id: 'visit-a' }, { id: 'visit-c' }],
      error: null,
    });
    mocks.createClient.mockReturnValue(
      queuedClient({
        invoices: [invoicesQuery],
        customer_visits: [visitsQuery],
      })
    );

    const { fetchCaptureMetrics } = await import(
      '../dashboardCaptureQueries'
    );
    await expect(
      fetchCaptureMetrics('shop-1', {
        start: '2026-06-01T00:00:00+05:30',
        end: '2026-06-30T23:59:59+05:30',
      })
    ).resolves.toEqual({
      billsWithCustomerPercent: 75,
      customerCaptures: 5,
      identifiedBills: 3,
      totalBills: 4,
      visits: 2,
    });

    expect(expectQueryCalls(invoicesQuery)).toEqual([
      { method: 'select', args: ['customer_id'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      { method: 'eq', args: ['status', 'completed'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
    expect(expectQueryCalls(visitsQuery)).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['shop_id', 'shop-1'] },
      {
        method: 'gte',
        args: ['created_at', '2026-06-01T00:00:00+05:30'],
      },
      {
        method: 'lte',
        args: ['created_at', '2026-06-30T23:59:59+05:30'],
      },
    ]);
  });

  it('keeps visit captures measurable while returning no bill percentage without bills', async () => {
    const invoicesQuery = createQueryBuilder({ data: [], error: null });
    const visitsQuery = createQueryBuilder({
      data: [{ id: 'visit-a' }, { id: 'visit-b' }],
      error: null,
    });
    mocks.createClient.mockReturnValue(
      queuedClient({
        invoices: [invoicesQuery],
        customer_visits: [visitsQuery],
      })
    );

    const { fetchCaptureMetrics } = await import(
      '../dashboardCaptureQueries'
    );
    await expect(
      fetchCaptureMetrics('shop-1', {
        start: '2026-07-13T00:00:00+05:30',
        end: '2026-07-13T23:59:59+05:30',
      })
    ).resolves.toEqual({
      billsWithCustomerPercent: null,
      customerCaptures: 2,
      identifiedBills: 0,
      totalBills: 0,
      visits: 2,
    });
  });
});
