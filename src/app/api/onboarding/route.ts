// =============================================================================
// BharatGrowth — Onboarding API Route
// POST /api/onboarding
// Creates a new shop + user record for first-time authenticated users
// Uses service role to bypass RLS (user doesn't have a shop_id yet)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface OnboardingBody {
  user_id: string;
  phone: string;
  business_name: string;
  business_type: string;
  city: string | null;
  state_code: string;
}

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

  // ── Check if user already has a shop ──
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('id', user_id)
    .single();

  if (existingUser) {
    return NextResponse.json(
      { error: 'User already onboarded' },
      { status: 409 }
    );
  }

  // ── Create shop ──
  const { data: shop, error: shopErr } = await admin
    .from('shops')
    .insert({
      business_name,
      business_type,
      city: city || null,
      state_code: state_code || '27',
      gst_type: 'composition', // Default to composition (simpler for new SMBs)
      subscription_plan: 'free',
      e_invoicing_enabled: false,
      settings: {},
    })
    .select('id')
    .single();

  if (shopErr || !shop) {
    console.error('[Onboarding] Shop creation failed:', shopErr);
    return NextResponse.json(
      { error: 'Failed to create shop' },
      { status: 500 }
    );
  }

  // ── Create user linked to shop ──
  const { error: userErr } = await admin
    .from('users')
    .insert({
      id: user_id,
      shop_id: shop.id,
      full_name: business_name,
      phone: phone || null,
      role: 'owner',
      is_active: true,
    });

  if (userErr) {
    console.error('[Onboarding] User creation failed:', userErr);
    // Rollback: delete the shop we just created
    await admin.from('shops').delete().eq('id', shop.id);
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
