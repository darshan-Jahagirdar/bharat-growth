// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingPage from '../page';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileMaybeSingle: vi.fn(),
  requestMaybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('../AccessRequestForm', () => ({
  default: ({ defaultEmail, userId }: { defaultEmail: string; userId: string }) => (
    <div>
      Request form {userId} {defaultEmail}
    </div>
  ),
}));

vi.mock('../ShopOnboardingForm', () => ({
  default: () => <div>Existing shop onboarding</div>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.profileMaybeSingle }),
          }),
        };
      }

      if (table === 'access_requests') {
        return {
          select: () => ({ maybeSingle: mocks.requestMaybeSingle }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

describe('onboarding access states', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'owner@example.test',
        },
      },
      error: null,
    });
    mocks.profileMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.requestMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('renders the request form when no request exists', async () => {
    render(await OnboardingPage());

    expect(
      screen.getByText(/Request form 11111111-1111-4111-8111-111111111111/)
    ).toHaveTextContent('owner@example.test');
  });

  it.each(['pending', 'dismissed'])(
    'renders the same pending message for %s',
    async (status) => {
      mocks.requestMaybeSingle.mockResolvedValueOnce({
        data: { status },
        error: null,
      });

      render(await OnboardingPage());

      expect(screen.getByText('Request received')).toBeInTheDocument();
      expect(
        screen.getByText(/We’re onboarding shops one at a time|We're onboarding shops one at a time/)
      ).toBeInTheDocument();
    }
  );

  it('renders existing onboarding only for an approved request', async () => {
    mocks.requestMaybeSingle.mockResolvedValueOnce({
      data: { status: 'approved' },
      error: null,
    });

    render(await OnboardingPage());

    expect(screen.getByText('Existing shop onboarding')).toBeInTheDocument();
  });

  it('redirects an existing shop owner to billing before reading requests', async () => {
    mocks.profileMaybeSingle.mockResolvedValueOnce({
      data: { shop_id: 'shop-1' },
      error: null,
    });

    await expect(OnboardingPage()).rejects.toThrow('redirect:/billing');
    expect(mocks.requestMaybeSingle).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated visitor to login', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(OnboardingPage()).rejects.toThrow(
      'redirect:/login?next=/onboarding'
    );
  });

  it('fails closed when request status cannot be read', async () => {
    mocks.requestMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(OnboardingPage()).rejects.toThrow(
      'Unable to verify access request status'
    );
  });
});
