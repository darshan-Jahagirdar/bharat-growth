import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignsPage from '../page';

interface QueryOperation {
  table: string;
  operation: 'select' | 'update';
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

interface ApprovalRow {
  campaigns_approved: boolean;
  campaigns_approval_requested_at: string | null;
}

const mocks = vi.hoisted(() => ({
  approval: {
    campaigns_approved: false,
    campaigns_approval_requested_at: null,
  } as ApprovalRow,
  checkUserOnboarded: vi.fn(),
  fetchRetentionStats: vi.fn(),
  getSession: vi.fn(),
  operations: [] as QueryOperation[],
}));

const RULES = [{
  id: 'rule-1',
  name: 'Tyre replacement reminder',
  trigger_days: 365,
  template_key: 'RESTOCK',
  custom_variable: 'Time to check your tyres',
  is_active: false,
  tags: { name: 'Tyres' },
}];

function resolveQuery(operation: QueryOperation) {
  mocks.operations.push({
    ...operation,
    filters: [...operation.filters],
  });

  if (operation.operation === 'select' && operation.table === 'shops') {
    return { data: { ...mocks.approval }, error: null };
  }
  if (operation.operation === 'select' && operation.table === 'campaign_rules') {
    return { data: RULES, error: null };
  }
  return { data: null, error: null };
}

function createQueryBuilder(table: string) {
  const operation: QueryOperation = {
    table,
    operation: 'select',
    filters: [],
  };

  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn((payload: unknown) => {
      operation.operation = 'update';
      operation.payload = payload;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      operation.filters.push([column, value]);
      return builder;
    }),
    order: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolveQuery(operation))),
    then: (
      onFulfilled: (value: ReturnType<typeof resolveQuery>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(resolveQuery(operation)).then(onFulfilled, onRejected),
  };

  return builder;
}

const supabase = {
  auth: { getSession: mocks.getSession },
  from: vi.fn((table: string) => createQueryBuilder(table)),
};

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/lib/dashboard/dashboardQueries', () => ({
  fetchRetentionStats: mocks.fetchRetentionStats,
}));

beforeEach(() => {
  mocks.approval = {
    campaigns_approved: false,
    campaigns_approval_requested_at: null,
  };
  mocks.operations.length = 0;
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
  mocks.fetchRetentionStats.mockResolvedValue({
    messagesSent: 0,
    customersReturned: 0,
    revenueAttributedPaise: 0,
    activeRulesCount: 0,
    perRule: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('campaign approval states', () => {
  it('requests approval without disabling configuration or claiming sending is live', async () => {
    render(<CampaignsPage />);

    expect(
      await screen.findByText('Campaign approval required before sending')
    ).toBeInTheDocument();
    expect(screen.getByText(/create recommended campaigns, use Enable all/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable all campaigns (1)' })).toBeEnabled();
    expect(screen.getByRole('switch')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Enable all campaigns (1)' }));
    expect(
      await screen.findByText(
        'All campaigns enabled. Sending will start after campaign approval.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request campaign approval' }));

    expect(await screen.findByText('Campaign approval pending')).toBeInTheDocument();
    const requestUpdate = mocks.operations.find(
      (operation) =>
        operation.table === 'shops' &&
        operation.operation === 'update'
    );
    expect(requestUpdate?.payload).toEqual({
      campaigns_approval_requested_at: expect.any(String),
    });
    expect(requestUpdate?.filters).toEqual([['id', 'shop-1']]);
    expect(
      new Date(
        (requestUpdate?.payload as { campaigns_approval_requested_at: string })
          .campaigns_approval_requested_at
      ).toString()
    ).not.toBe('Invalid Date');
  });

  it('renders the pending state while preserving existing rule controls', async () => {
    mocks.approval = {
      campaigns_approved: false,
      campaigns_approval_requested_at: '2026-08-01T08:00:00.000Z',
    };

    render(<CampaignsPage />);

    expect(await screen.findByText('Campaign approval pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request campaign approval' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable all campaigns (1)' })).toBeEnabled();
    expect(screen.getByRole('switch')).toBeEnabled();
  });

  it('keeps the approved page and success behavior unchanged', async () => {
    mocks.approval = {
      campaigns_approved: true,
      campaigns_approval_requested_at: '2026-07-31T08:00:00.000Z',
    };

    render(<CampaignsPage />);

    expect(await screen.findByText('Tyre replacement reminder')).toBeInTheDocument();
    expect(screen.queryByText(/Campaign approval/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable all campaigns (1)' }));
    await waitFor(() => {
      expect(
        screen.getByText('All campaigns enabled. Reminders go out automatically.')
      ).toBeInTheDocument();
    });
  });
});
