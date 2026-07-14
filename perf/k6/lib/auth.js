// =============================================================================
// perf/k6/lib/auth.js — GoTrue password-grant login with per-VU token cache.
// Mints a real Supabase JWT so requests exercise RLS as an authenticated user.
// =============================================================================

import http from 'k6/http';
import { SUPABASE_URL, ANON_KEY } from './config.js';

// Per-VU cache (module state is per-VU in k6): email -> access_token.
const tokenCache = {};

export function login(email, password) {
  if (tokenCache[email]) return tokenCache[email];
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json', apikey: ANON_KEY }, tags: { op: 'auth_login' } }
  );
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${res.body}`);
  }
  const token = res.json('access_token');
  tokenCache[email] = token;
  return token;
}

// Headers for an authenticated PostgREST / RPC call.
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}
