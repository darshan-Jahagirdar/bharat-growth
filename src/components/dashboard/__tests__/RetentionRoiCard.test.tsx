import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RetentionStats } from '@/lib/dashboard/dashboardQueries';
import { RetentionRoiCard } from '../RetentionRoiCard';

const ARMED_STATS: RetentionStats = {
  messagesSent: 0,
  customersReturned: 0,
  revenueAttributedPaise: 0,
  activeRulesCount: 2,
  perRule: [],
};

afterEach(cleanup);

describe('RetentionRoiCard campaign approval', () => {
  it('does not describe configured rules as live before approval', () => {
    render(
      <RetentionRoiCard
        campaignsApproved={false}
        stats={ARMED_STATS}
      />
    );

    expect(
      screen.getByText('Bring-Back is configured — campaign approval required')
    ).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp reminders start only after/)).toBeInTheDocument();
    expect(screen.queryByText(/Bring-Back is live/)).not.toBeInTheDocument();
  });

  it('preserves the existing live state for an approved shop', () => {
    render(
      <RetentionRoiCard
        campaignsApproved
        stats={ARMED_STATS}
      />
    );

    expect(
      screen.getByText('Bring-Back is live — 2 campaigns watching your customers')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Reminders go out automatically when a customer is due to come back.')
    ).toBeInTheDocument();
  });

  it('keeps historical return proof visible when future sending is unapproved', () => {
    render(
      <RetentionRoiCard
        campaignsApproved={false}
        stats={{
          ...ARMED_STATS,
          customersReturned: 1,
          revenueAttributedPaise: 25_000,
        }}
      />
    );

    expect(screen.getByText('₹250.00')).toBeInTheDocument();
    expect(screen.getByText('brought back')).toBeInTheDocument();
  });
});
