// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireShopPageAccess } from '../requireShopPageAccess';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

describe('requireShopPageAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { shop_id: 'shop-1' },
      error: null,
    });
  });

  it('returns the active shop for a grandfathered user', async () => {
    await expect(requireShopPageAccess('/billing')).resolves.toBe('shop-1');
  });

  it('redirects a profile-less user to onboarding', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(requireShopPageAccess('/dashboard')).rejects.toThrow(
      'redirect:/onboarding'
    );
  });

  it('redirects an unauthenticated user to login with the protected path', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(requireShopPageAccess('/billing')).rejects.toThrow(
      'redirect:/login?next=%2Fbilling'
    );
  });

  it('fails closed on profile lookup errors', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(requireShopPageAccess('/billing')).rejects.toThrow(
      'Unable to verify shop access'
    );
  });
});
