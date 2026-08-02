// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BillingLayout from '@/app/billing/layout';
import DashboardLayout from '@/app/dashboard/layout';

const mocks = vi.hoisted(() => ({
  requireShopPageAccess: vi.fn(),
}));

vi.mock('../requireShopPageAccess', () => ({
  requireShopPageAccess: mocks.requireShopPageAccess,
}));

describe('protected product layouts', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireShopPageAccess.mockResolvedValue('shop-1');
  });

  it('guards billing before rendering its client workspace', async () => {
    render(
      await BillingLayout({
        children: <div>Billing workspace</div>,
      })
    );

    expect(mocks.requireShopPageAccess).toHaveBeenCalledWith('/billing');
    expect(screen.getByText('Billing workspace')).toBeInTheDocument();
  });

  it('guards dashboard and every nested dashboard surface through its layout', async () => {
    render(
      await DashboardLayout({
        children: <div>Dashboard workspace</div>,
      })
    );

    expect(mocks.requireShopPageAccess).toHaveBeenCalledWith('/dashboard');
    expect(screen.getByText('Dashboard workspace')).toBeInTheDocument();
  });
});
