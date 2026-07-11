// =============================================================================
// BharatGrowth — Default Bring-Back Campaigns per Vertical
//
// Seeded at onboarding (and retrofittable via /api/campaigns/seed-defaults).
// Rules are created INACTIVE — the shopkeeper flips them on from the
// campaigns page, which is a deliberate DPDP posture: activation is an
// explicit decision, and a brand-new shop has zero consented customers anyway.
//
// custom_variable is the Meta template {{3}} slot — keep it under 60 chars
// (enforced by a CHECK constraint, migration 036).
// =============================================================================

import type { BusinessType } from '@/lib/types/database';
import type { TemplateKey } from '@/lib/whatsapp/templates';

export interface DefaultCampaign {
  tagName: string;
  ruleName: string;
  triggerDays: number;
  templateKey: Extract<TemplateKey, 'PROMO' | 'RESTOCK' | 'NEW_ARRIVAL'>;
  customVariable: string;
}

export const DEFAULT_CAMPAIGNS: Record<BusinessType, DefaultCampaign[]> = {
  tyre_shop: [
    {
      tagName: 'Tyres',
      ruleName: 'Free alignment check · 6 months',
      triggerDays: 180,
      templateKey: 'RESTOCK',
      customVariable: 'a free wheel alignment & rotation check',
    },
    {
      tagName: 'Tyres',
      ruleName: 'Tyre replacement due · 3 years',
      triggerDays: 1100,
      templateKey: 'RESTOCK',
      customVariable: 'new tyres — it has been about 3 years',
    },
    {
      tagName: 'Battery',
      ruleName: 'Battery health check · 3 years',
      triggerDays: 1050,
      templateKey: 'RESTOCK',
      customVariable: 'a free battery health check',
    },
  ],
  sweet_stall: [
    {
      tagName: 'Sweets',
      ruleName: 'Fresh sweets nudge · 25 days',
      triggerDays: 25,
      templateKey: 'RESTOCK',
      customVariable: 'fresh sweets, made today',
    },
    {
      tagName: 'Gift Boxes',
      ruleName: 'Festive gift boxes · yearly',
      triggerDays: 350,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'festive gift boxes for the season',
    },
  ],
  garment_store: [
    {
      tagName: 'Garments',
      ruleName: 'New season collection · 6 months',
      triggerDays: 170,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'the new season collection',
    },
  ],
  general: [
    {
      tagName: 'Regular Items',
      ruleName: 'We miss you · 45 days',
      triggerDays: 45,
      templateKey: 'PROMO',
      customVariable: 'a special offer on your regulars',
    },
  ],
};
