import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../useAuth';

const authTestHarness = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  };

  return {
    auth,
    client: { auth },
  };
});

const authMocks = authTestHarness.auth;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => authTestHarness.client,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getSession.mockResolvedValue({ data: { session: null } });
  authMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: authMocks.unsubscribe } },
  });
  authMocks.signInWithOtp.mockResolvedValue({ error: null });
  authMocks.verifyOtp.mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
  authMocks.signOut.mockResolvedValue({ error: null });
});

describe('phone OTP contract', () => {
  it('uses one canonical E.164 value for send, verify, and resend', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.sendOtp('0000000000')).toBe(true);
    });
    expect(authMocks.signInWithOtp).toHaveBeenNthCalledWith(1, {
      phone: '+910000000000',
    });

    await act(async () => {
      expect(await result.current.verifyOtp('123456')).toBe(true);
    });
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      phone: '+910000000000',
      token: '123456',
      type: 'sms',
    });

    await act(async () => {
      expect(await result.current.sendOtp('0000000000')).toBe(true);
    });
    expect(authMocks.signInWithOtp).toHaveBeenNthCalledWith(2, {
      phone: '+910000000000',
    });
  });
});
