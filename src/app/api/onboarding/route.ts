// =============================================================================
// BharatGrowth — Onboarding API Route
// POST /api/onboarding
// Creates a new shop + user record for first-time authenticated users
// Uses service role to bypass RLS (user doesn't have a shop_id yet)
//
// Network resilience: exponential backoff retries (up to 3 attempts)
// Rollback safety: orphaned shops are deleted if user creation fails
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

interface OnboardingBody {
  user_id: string;
  phone: string;
  business_name: string;
  business_type: string;
  city: string | null;
  state_code: string;
}

// ─── Retry helper with exponential backoff ──────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500; // 500ms, 1000ms, 2000ms

interface RetryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function isNetworkError(err: { message?: string; code?: string }): boolean {
  const msg = err.message ?? '';
  const code = err.code ?? '';
  return (
    msg.includes('CONNECT_TIMEOUT') ||
    msg.includes('UND_ERR') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed') ||
    code === 'PGRST301'
  );
}

async function withRetry<T>(
  fn: () => Promise<RetryResult<T>>,
  label: string
): Promise<RetryResult<T>> {
  let lastResult: RetryResult<T> = { data: null, error: { message: 'Unknown error' } };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastResult = await fn();

    // Success
    if (!lastResult.error) return lastResult;

    // Non-retryable — fail fast
    if (!isNetworkError(lastResult.error)) {
      console.error(`[Onboarding] ${label} failed (non-retryable):`, lastResult.error);
      return lastResult;
    }

    // Retryable — backoff
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[Onboarding] ${label} attempt ${attempt}/${MAX_RETRIES} failed (${lastResult.error.message}). Retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      console.error(
        `[Onboarding] ${label} failed after ${MAX_RETRIES} attempts:`,
        lastResult.error
      );
    }
  }

  return lastResult;
}

// ─── Rollback: delete orphaned shop ─────────────────────────────────────────

async function rollbackShop(admin: SupabaseClient, shopId: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await admin.from('shops').delete().eq('id', shopId);
    if (!error) {
      console.log(`[Onboarding] Rollback: deleted orphaned shop ${shopId}`);
      return;
    }
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[Onboarding] Rollback attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      console.error(`[Onboarding] Rollback FAILED for shop ${shopId} — manual cleanup needed:`, error);
    }
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: OnboardingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { user_id, phone, business_name, business_type, city, state_code } = body;

  if (!user_id || !business_name || !business_type) {
    return NextResponse.json(
      { error: 'Missing required fields: user_id, business_name, business_type' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // ── Check if user already has a shop (with retry) ──
  const { data: existingUser } = await withRetry<{ id: string }>(
    async () => {
      const result = await admin.from('users').select('id').eq('id', user_id).single();
      return result;
    },
    'Check existing user'
  );

  if (existingUser) {
    return NextResponse.json(
      { error: 'User already onboarded' },
      { status: 409 }
    );
  }

  // ── Create shop (with retry) ──
  const { data: shop, error: shopErr } = await withRetry<{ id: string }>(
    async () => {
      const result = await admin
        .from('shops')
        .insert({
          business_name,
          business_type,
          city: city || null,
          state_code: state_code || '27',
          gst_type: 'composition',
          subscription_plan: 'free',
          e_invoicing_enabled: false,
          settings: {},
        })
        .select('id')
        .single();
      return result;
    },
    'Create shop'
  );

  if (shopErr || !shop) {
    return NextResponse.json(
      { error: 'Failed to create shop' },
      { status: 500 }
    );
  }

  // ── Create user linked to shop (with retry) ──
  const { error: userErr } = await withRetry<{ id: string }>(
    async () => {
      const result = await admin
        .from('users')
        .insert({
          id: user_id,
          shop_id: shop.id,
          full_name: business_name,
          phone: phone || null,
          role: 'owner',
          is_active: true,
        })
        .select('id')
        .single();
      return result;
    },
    'Create user'
  );

  if (userErr) {
    // Rollback: delete the shop we just created (also with retry)
    await rollbackShop(admin, shop.id);
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    shop_id: shop.id,
    message: 'Shop and user created successfully',
  });
}
