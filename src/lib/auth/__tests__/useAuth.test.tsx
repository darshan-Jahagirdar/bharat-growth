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

describe('email OTP contract', () => {
  it('sends, verifies, and resends a normalized email OTP without redirect options', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.sendEmailOtp('  Test.User+OTP@Example.com  ')).toBe(true);
    });
    expect(authMocks.signInWithOtp).toHaveBeenNthCalledWith(1, {
      email: 'test.user+otp@example.com',
    });
    expect(result.current.step).toBe('email_otp');

    await act(async () => {
      expect(await result.current.verifyOtp('654321')).toBe(true);
    });
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      email: 'test.user+otp@example.com',
      token: '654321',
      type: 'email',
    });

    await act(async () => {
      expect(await result.current.sendEmailOtp(result.current.email)).toBe(true);
    });
    expect(authMocks.signInWithOtp).toHaveBeenNthCalledWith(2, {
      email: 'test.user+otp@example.com',
    });
  });

  it('keeps the email OTP step and exposes the provider error for a wrong code', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendEmailOtp('wrong-code@example.com');
    });

    authMocks.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' },
    });

    await act(async () => {
      expect(await result.current.verifyOtp('000000')).toBe(false);
    });

    expect(result.current.step).toBe('email_otp');
    expect(result.current.error).toBe('Token has expired or is invalid');
  });
});
