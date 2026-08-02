// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage, { metadata } from '../page';

const mocks = vi.hoisted(() => ({
  getPlatformAdminIdentity: vi.fn(),
  createAdminClient: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('@/lib/access/platformAdmin', () => ({
  getPlatformAdminIdentity: mocks.getPlatformAdminIdentity,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock('../actions', () => ({
  approveAccessRequest: vi.fn(),
  dismissAccessRequest: vi.fn(),
}));

describe('/admin access request queue', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformAdminIdentity.mockResolvedValue({
      ok: true,
      userId: 'admin-1',
      email: 'admin@example.test',
    });
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({ eq: mocks.eq }),
      }),
    });
    mocks.eq.mockReturnValue({ order: mocks.order });
    mocks.order.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          full_name: 'Owner',
          business_name: 'Growth Store',
          business_type: 'grocery',
          city: 'Pune',
          email: 'owner@example.test',
          status: 'pending',
          requested_at: '2026-08-02T09:00:00.000Z',
          reviewed_at: null,
        },
      ],
      error: null,
    });
  });

  it('is noindex and nofollow', () => {
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('renders the pending queue only after server-side admin verification', async () => {
    render(await AdminPage());

    expect(mocks.getPlatformAdminIdentity).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith('status', 'pending');
    expect(mocks.order).toHaveBeenCalledWith('requested_at', {
      ascending: true,
    });
    expect(screen.getByText('Growth Store')).toBeInTheDocument();
    expect(screen.getByText(/Owner · owner@example.test/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('denies an authenticated non-admin server-side', async () => {
    mocks.getPlatformAdminIdentity.mockResolvedValueOnce({
      ok: false,
      reason: 'forbidden',
    });

    await expect(AdminPage()).rejects.toThrow('not-found');
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated visitors to login', async () => {
    mocks.getPlatformAdminIdentity.mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    });

    await expect(AdminPage()).rejects.toThrow(
      'redirect:/login?next=/admin'
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
