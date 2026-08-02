// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformAdminIdentity } from '../platformAdmin';

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

describe('getPlatformAdminIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PLATFORM_ADMIN_EMAIL', 'hello@example.test');
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
    });
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          email: 'hello@example.test',
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches the configured email case-insensitively with whitespace trimmed', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAIL', '  ADMIN@Example.Test ');
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'admin-1',
          email: ' admin@example.test ',
        },
      },
      error: null,
    });

    await expect(getPlatformAdminIdentity()).resolves.toEqual({
      ok: true,
      userId: 'admin-1',
      email: 'admin@example.test',
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it('fails closed when the admin email is not configured', async () => {
    vi.stubEnv('PLATFORM_ADMIN_EMAIL', '');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getPlatformAdminIdentity()).resolves.toEqual({
      ok: false,
      reason: 'misconfigured',
    });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[Access admin] PLATFORM_ADMIN_EMAIL is not configured'
    );
  });

  it('denies authenticated users whose verified identity does not match', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'shop@example.test',
        },
      },
      error: null,
    });

    await expect(getPlatformAdminIdentity()).resolves.toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('denies phone-only identities', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: null } },
      error: null,
    });

    await expect(getPlatformAdminIdentity()).resolves.toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('treats a missing verified user as unauthenticated', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid session' },
    });

    await expect(getPlatformAdminIdentity()).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    });
  });
});
