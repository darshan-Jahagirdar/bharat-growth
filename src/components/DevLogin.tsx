'use client';

// =============================================================================
// BharatGrowth — Dev Mode Login (temporary, for development only)
// Signs in as dev@bharatgrowth.in to satisfy RLS policies
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const DEV_EMAIL = 'dev@bharatgrowth.in';
const DEV_PASSWORD = 'devpass123';

export default function DevLogin() {
  const [status, setStatus] = useState<'checking' | 'logged-out' | 'logged-in' | 'error'>('checking');
  const [userName, setUserName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('logged-in');
        setUserName(session.user.user_metadata?.full_name ?? session.user.email ?? '');
      } else {
        setStatus('logged-out');
      }
    });
  }, [supabase]);

  const handleLogin = async () => {
    setStatus('checking');
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }

    setStatus('logged-in');
    setUserName(data.user.user_metadata?.full_name ?? data.user.email ?? '');

    // Reload to re-fetch data with RLS context
    window.location.reload();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setStatus('logged-out');
    setUserName('');
    window.location.reload();
  };

  // Don't render in production
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-yellow-900/90 backdrop-blur border-b border-yellow-700 px-3 py-1.5 text-xs flex items-center justify-center gap-3">
      <span className="text-yellow-400 font-semibold">DEV MODE</span>

      {status === 'checking' && (
        <span className="text-yellow-300/60">Checking auth...</span>
      )}

      {status === 'logged-out' && (
        <button
          onClick={handleLogin}
          className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors"
        >
          Login as Ganesh Tyres
        </button>
      )}

      {status === 'logged-in' && (
        <>
          <span className="text-emerald-400">
            Logged in: {userName}
          </span>
          <button
            onClick={handleLogout}
            className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Logout
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <span className="text-red-400">
            Error: {errorMsg}
          </span>
          <button
            onClick={handleLogin}
            className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}
