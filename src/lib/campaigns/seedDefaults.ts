// =============================================================================
// BharatGrowth — Seed Default Bring-Back Campaigns
// Shared by:
//   * /api/onboarding        (admin client, right after shop creation)
//   * /api/campaigns/seed-defaults (user's RLS client, retrofit for shops
//     onboarded before the campaigns feature existed)
//
// Idempotent: existing tag names are reused (upsert on shop_id+name) and
// rules whose names already exist for the shop are skipped.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessType } from '@/lib/types/database';
import { DEFAULT_CAMPAIGNS } from './defaults';

export interface SeedResult {
  tagsCreated: number;
  rulesCreated: number;
}

export async function seedDefaultCampaigns(
  client: SupabaseClient,
  shopId: string,
  businessType: BusinessType
): Promise<SeedResult> {
  const defaults = DEFAULT_CAMPAIGNS[businessType] ?? DEFAULT_CAMPAIGNS.general;

  // ── 1. Upsert tags (reuse existing by shop_id + name) ──
  const tagNames = [...new Set(defaults.map((d) => d.tagName))];

  const { data: tags, error: tagErr } = await client
    .from('tags')
    .upsert(
      tagNames.map((name) => ({ shop_id: shopId, name })),
      { onConflict: 'shop_id,name', ignoreDuplicates: false }
    )
    .select('id, name');

  if (tagErr || !tags) {
    throw new Error(`Tag seeding failed: ${tagErr?.message ?? 'no rows returned'}`);
  }

  const tagIdByName = new Map(tags.map((t) => [t.name as string, t.id as string]));

  // ── 2. Insert rules, skipping names that already exist for this shop ──
  const { data: existingRules, error: existingErr } = await client
    .from('campaign_rules')
    .select('name')
    .eq('shop_id', shopId);

  if (existingErr) {
    throw new Error(`Existing rules lookup failed: ${existingErr.message}`);
  }

  const existingNames = new Set((existingRules ?? []).map((r) => r.name as string));

  const rulesToInsert = defaults
    .filter((d) => !existingNames.has(d.ruleName))
    .map((d) => ({
      shop_id: shopId,
      tag_id: tagIdByName.get(d.tagName),
      name: d.ruleName,
      trigger_days: d.triggerDays,
      template_key: d.templateKey,
      custom_variable: d.customVariable,
      // Inactive by default: activation is an explicit shopkeeper decision
      // (deliberate DPDP posture), done from /dashboard/campaigns.
      is_active: false,
      message_template: null,
    }))
    .filter((r) => r.tag_id != null);

  if (rulesToInsert.length > 0) {
    const { error: ruleErr } = await client.from('campaign_rules').insert(rulesToInsert);
    if (ruleErr) {
      throw new Error(`Rule seeding failed: ${ruleErr.message}`);
    }
  }

  return { tagsCreated: tags.length, rulesCreated: rulesToInsert.length };
}
