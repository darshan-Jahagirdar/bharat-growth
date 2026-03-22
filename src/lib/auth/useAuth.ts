'use client';

// =============================================================================
// BharatGrowth — Supabase Auth Hook (Mobile OTP)
// Handles signInWithOtp, verifyOtp, session management
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AuthStep = 'phone' | 'otp' | 'authenticated';

export interface AuthState {
  step: AuthStep;
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  phone: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    step: 'phone',
    user: null,
    session: null,
    loading: true,
    error: null,
    phone: '',
  });

  const supabase = createClient();

  // ── Check existing session on mount ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState((s) => ({
          ...s,
          step: 'authenticated',
          user: session.user,
          session,
          loading: false,
        }));
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        user: session?.user ?? null,
        session,
        step: session ? 'authenticated' : 'phone',
      }));
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── Send OTP to phone number ──
  const sendOtp = useCallback(
    async (phone: string) => {
      setState((s) => ({ ...s, loading: true, error: null, phone }));

      // Normalize to E.164: +91XXXXXXXXXX
      const normalized = phone.startsWith('+91')
        ? phone
        : `+91${phone.replace(/\D/g, '')}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });

      if (error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: error.message,
        }));
        return false;
      }

      setState((s) => ({
        ...s,
        step: 'otp',
        phone: normalized,
        loading: false,
      }));
      return true;
    },
    [supabase]
  );

  // ── Verify OTP ──
  const verifyOtp = useCallback(
    async (otp: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase.auth.verifyOtp({
        phone: state.phone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: error.message,
        }));
        return false;
      }

      setState((s) => ({
        ...s,
        step: 'authenticated',
        user: data.user,
        session: data.session,
        loading: false,
      }));
      return true;
    },
    [supabase, state.phone]
  );

  // ── Sign out ──
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      step: 'phone',
      user: null,
      session: null,
      loading: false,
      error: null,
      phone: '',
    });
  }, [supabase]);

  // ── Go back to phone step ──
  const goBack = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 'phone',
      error: null,
    }));
  }, []);

  // ── Clear error ──
  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    ...state,
    sendOtp,
    verifyOtp,
    signOut,
    goBack,
    clearError,
  };
}
