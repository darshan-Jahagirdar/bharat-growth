'use client';

// =============================================================================
// BharatGrowth — Login Page (Mobile OTP)
// Conversion-optimized: phone → OTP → redirect
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';

export default function LoginPage() {
  const router = useRouter();
  const { step, user, loading, error, sendOtp, verifyOtp, goBack, clearError } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Redirect if already authenticated ──
  useEffect(() => {
    if (step === 'authenticated' && user) {
      checkUserOnboarded(user.id).then((ctx) => {
        if (ctx) {
          router.replace('/billing');
        } else {
          router.replace('/onboarding');
        }
      });
    }
  }, [step, user, router]);

  // ── Phone input handler ──
  const handlePhoneChange = (value: string) => {
    // Only digits, max 10
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    clearError();
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) return;
    await sendOtp(phone);
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    clearError();

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = otp.join('');
      if (code.length === 6) handleVerify();
    }
  };

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasted.length === 6) {
        const newOtp = pasted.split('');
        setOtp(newOtp);
        otpRefs.current[5]?.focus();
      }
    },
    []
  );

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    await verifyOtp(code);
  };

  const handleGoBack = () => {
    setOtp(['', '', '', '', '', '']);
    goBack();
  };

  // ── Auto-focus first OTP input when step changes ──
  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  // ── If already authenticated, show loading ──
  if (step === 'authenticated') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-400 text-sm mt-3">Redirecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* ── Top section with branding ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold">
            <span className="text-orange-500">Bharat</span>
            <span className="text-gray-200">Growth</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Speed Billing for Indian SMBs
          </p>
        </div>

        {/* ── Card ── */}
        <div className="w-full max-w-sm">
          {step === 'phone' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-200">
                  Welcome back
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Enter your phone number to continue
                </p>
              </div>

              {/* Phone input */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 ml-1">
                  Mobile Number
                </label>
                <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-orange-600 transition-colors">
                  <span className="pl-4 pr-2 text-gray-400 text-sm font-medium select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendOtp();
                    }}
                    placeholder="98765 43210"
                    className="flex-1 bg-transparent py-3.5 pr-4 text-lg text-gray-100 placeholder:text-gray-600
                               outline-none tracking-wider font-mono"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-red-400 text-xs text-center bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Send OTP button */}
              <button
                onClick={handleSendOtp}
                disabled={phone.length !== 10 || loading}
                className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500
                           disabled:bg-gray-800 disabled:text-gray-600
                           text-white font-semibold text-sm transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>

              {/* Dev login shortcut */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="text-center">
                  <button
                    onClick={async () => {
                      const { createClient } = await import('@/lib/supabase/client');
                      const supabase = createClient();
                      const { error: devErr } = await supabase.auth.signInWithPassword({
                        email: 'dev@bharatgrowth.in',
                        password: 'devpass123',
                      });
                      if (!devErr) window.location.href = '/billing';
                    }}
                    className="text-xs text-yellow-600 hover:text-yellow-500 underline"
                  >
                    Dev: Login as Ganesh Tyres
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-200">
                  Verify OTP
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Enter the 6-digit code sent to
                </p>
                <p className="text-orange-400 text-sm font-mono mt-0.5">
                  +91 {phone.replace(/\D/g, '').replace(/(\d{5})(\d{5})/, '$1 $2')}
                </p>
              </div>

              {/* OTP input boxes */}
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-13 text-center text-xl font-mono font-bold
                               bg-gray-900 border border-gray-700 rounded-lg
                               text-gray-100 outline-none
                               focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30
                               transition-colors"
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="text-red-400 text-xs text-center bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={otp.join('').length !== 6 || loading}
                className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500
                           disabled:bg-gray-800 disabled:text-gray-600
                           text-white font-semibold text-sm transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              {/* Back / Resend */}
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={handleGoBack}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Change number
                </button>
                <button
                  onClick={() => sendOtp(phone.replace(/\D/g, ''))}
                  disabled={loading}
                  className="text-orange-500 hover:text-orange-400 disabled:text-gray-600 transition-colors"
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom tagline ── */}
      <div className="text-center pb-6 text-[10px] text-gray-700">
        By continuing, you agree to our Terms of Service &amp; Privacy Policy
      </div>
    </div>
  );
}
