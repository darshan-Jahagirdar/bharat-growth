// =============================================================================
// BharatGrowth — Seed Default Campaigns (retrofit)
// POST /api/campaigns/seed-defaults
//
// For shops onboarded before the Bring-Back feature existed. Creates the
// vertical's default tags + inactive campaign rules under the caller's RLS
// (tags/campaign_rules both have per-shop insert policies).
// =============================================================================

import { NextResponse } from 'next/server';
import { requireShopUser } from '@/lib/api/requireShopUser';
import { seedDefaultCampaigns } from '@/lib/campaigns/seedDefaults';
import type { BusinessType } from '@/lib/types/database';

const VALID_BUSINESS_TYPES = new Set<BusinessType>([
  'tyre_shop',
  'sweet_stall',
  'garment_store',
  'grocery',
  'general',
]);

export async function POST() {
  const ctx = await requireShopUser();
  if (!ctx.ok) return ctx.response;

  const { data: shop, error: shopErr } = await ctx.supabase
    .from('shops')
    .select('business_type')
    .eq('id', ctx.shopId)
    .single();

  if (shopErr || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const businessType: BusinessType = VALID_BUSINESS_TYPES.has(
    shop.business_type as BusinessType
  )
    ? (shop.business_type as BusinessType)
    : 'general';

  try {
    const result = await seedDefaultCampaigns(ctx.supabase, ctx.shopId, businessType);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seeding failed';
    console.error('[Campaigns] seed-defaults failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
