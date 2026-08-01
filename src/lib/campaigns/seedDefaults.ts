// =============================================================================
// BharatGrowth — Seed Default Bring-Back Campaigns
// Shared by:
//   * /api/onboarding        (admin client, right after shop creation)
//   * /api/campaigns/seed-defaults (user's RLS client, retrofit for shops
//     onboarded before the campaigns feature existed)
//
// Idempotent for sequential requests: existing tags and matching rules are
// reused without writes.
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

  // ── 1. Reuse existing tags and insert only missing names ──
  const tagNames = [...new Set(defaults.map((d) => d.tagName))];

  const { data: existingTags, error: existingTagErr } = await client
    .from('tags')
    .select('id, name')
    .eq('shop_id', shopId)
    .in('name', tagNames);

  if (existingTagErr) {
    throw new Error(`Existing tags lookup failed: ${existingTagErr.message}`);
  }

  const existingTagNames = new Set(
    (existingTags ?? []).map((tag) => tag.name as string)
  );
  const missingTagNames = tagNames.filter((name) => !existingTagNames.has(name));

  let createdTags: Array<{ id: string; name: string }> = [];
  if (missingTagNames.length > 0) {
    const { data, error: tagInsertErr } = await client
      .from('tags')
      .insert(missingTagNames.map((name) => ({ shop_id: shopId, name })))
      .select('id, name');

    if (tagInsertErr || !data) {
      throw new Error(
        `Tag seeding failed: ${tagInsertErr?.message ?? 'no rows returned'}`
      );
    }

    createdTags = data as Array<{ id: string; name: string }>;
  }

  const tags = [...(existingTags ?? []), ...createdTags];
  const tagIdByName = new Map(
    tags.map((tag) => [tag.name as string, tag.id as string])
  );

  // ── 2. Insert only rules whose behavioral identity is not present ──
  const { data: existingRules, error: existingErr } = await client
    .from('campaign_rules')
    .select('tag_id, trigger_days, template_key')
    .eq('shop_id', shopId);

  if (existingErr) {
    throw new Error(`Existing rules lookup failed: ${existingErr.message}`);
  }

  const ruleKey = (
    tagId: string,
    triggerDays: number,
    templateKey: string
  ) => JSON.stringify([tagId, triggerDays, templateKey]);
  const existingRuleKeys = new Set(
    (existingRules ?? []).map((rule) =>
      ruleKey(
        rule.tag_id as string,
        rule.trigger_days as number,
        rule.template_key as string
      )
    )
  );

  const rulesToInsert = defaults
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
    .filter(
      (rule): rule is typeof rule & { tag_id: string } =>
        rule.tag_id != null &&
        !existingRuleKeys.has(
          ruleKey(rule.tag_id, rule.trigger_days, rule.template_key)
        )
    );

  if (rulesToInsert.length > 0) {
    // Concurrent manually-triggered requests can still race. A DB uniqueness
    // constraint is intentionally absent because duplicate custom rules are valid.
    const { error: ruleErr } = await client.from('campaign_rules').insert(rulesToInsert);
    if (ruleErr) {
      throw new Error(`Rule seeding failed: ${ruleErr.message}`);
    }
  }

  return {
    tagsCreated: createdTags.length,
    rulesCreated: rulesToInsert.length,
  };
}
