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
import type { CampaignTemplateKey } from '@/lib/whatsapp/templates';

export interface DefaultCampaign {
  tagName: string;
  ruleName: string;
  triggerDays: number;
  templateKey: CampaignTemplateKey;
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
    {
      tagName: 'Engine Oil',
      ruleName: 'Oil change due · 6 months',
      triggerDays: 180,
      templateKey: 'RESTOCK',
      customVariable: 'an engine oil change — about 6 months due',
    },
    {
      tagName: 'Filters',
      ruleName: 'Filter change due · 6 months',
      triggerDays: 180,
      templateKey: 'RESTOCK',
      customVariable: 'an air & oil filter change',
    },
    {
      tagName: 'Brake Pads',
      ruleName: 'Brake inspection · yearly',
      triggerDays: 365,
      templateKey: 'RESTOCK',
      customVariable: 'a brake inspection — a year since last time',
    },
    {
      tagName: 'Coolant',
      ruleName: 'Coolant top-up · yearly',
      triggerDays: 365,
      templateKey: 'RESTOCK',
      customVariable: 'a coolant top-up before the summer heat',
    },
    {
      tagName: 'Wipers',
      ruleName: 'Wiper replacement · 10 months',
      triggerDays: 300,
      templateKey: 'RESTOCK',
      customVariable: 'new wiper blades before the monsoon',
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
    {
      tagName: 'Namkeen',
      ruleName: 'Fresh namkeen nudge · 20 days',
      triggerDays: 20,
      templateKey: 'RESTOCK',
      customVariable: 'fresh namkeen & savouries',
    },
    {
      tagName: 'Dry Fruits',
      ruleName: 'Dry fruits restock · 3 months',
      triggerDays: 90,
      templateKey: 'RESTOCK',
      customVariable: 'fresh dry fruits, newly stocked',
    },
    {
      tagName: 'Cakes',
      ruleName: 'Celebration cake · yearly',
      triggerDays: 365,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'a celebration cake — same time last year',
    },
    {
      tagName: 'Festive Specials',
      ruleName: 'Festive specials · yearly',
      triggerDays: 350,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'festive specials — made fresh this season',
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
    {
      tagName: 'School Uniforms',
      ruleName: 'School uniform season · yearly',
      triggerDays: 365,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'school uniforms for the new academic year',
    },
    {
      tagName: 'Kids Wear',
      ruleName: 'Kids outgrow sizes · 4 months',
      triggerDays: 120,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'the next size up — kids grow fast',
    },
    {
      tagName: 'Festive Wear',
      ruleName: 'Festive collection · yearly',
      triggerDays: 350,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'festive collection for the season',
    },
    {
      tagName: 'Winter Wear',
      ruleName: 'Winter collection · yearly',
      triggerDays: 365,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'winter wear — sweaters, jackets & shawls',
    },
    {
      tagName: 'Ethnic & Sarees',
      ruleName: 'Wedding season ethnic · 6 months',
      triggerDays: 180,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'new ethnic wear for the wedding season',
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
    {
      tagName: 'Seasonal',
      ruleName: 'Seasonal collection · yearly',
      triggerDays: 350,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'our new seasonal collection',
    },
  ],
  grocery: [
    {
      tagName: 'Staples',
      ruleName: 'Monthly staples restock · 30 days',
      triggerDays: 30,
      templateKey: 'RESTOCK',
      customVariable: 'your monthly rice, atta & dal restock',
    },
    {
      tagName: 'Cooking Oil',
      ruleName: 'Cooking oil restock · 30 days',
      triggerDays: 30,
      templateKey: 'RESTOCK',
      customVariable: 'cooking oil — about a month since last time',
    },
    {
      tagName: 'Cleaning & Detergent',
      ruleName: 'Cleaning supplies · 40 days',
      triggerDays: 40,
      templateKey: 'RESTOCK',
      customVariable: 'detergent & cleaning supplies',
    },
    {
      tagName: 'Personal Care',
      ruleName: 'Personal care restock · 45 days',
      triggerDays: 45,
      templateKey: 'RESTOCK',
      customVariable: 'soap, shampoo & daily essentials',
    },
    {
      tagName: 'Baby Care',
      ruleName: 'Baby care restock · 21 days',
      triggerDays: 21,
      templateKey: 'RESTOCK',
      customVariable: 'baby care essentials — diapers & formula',
    },
    {
      tagName: 'Pet Food',
      ruleName: 'Pet food restock · 30 days',
      triggerDays: 30,
      templateKey: 'RESTOCK',
      customVariable: 'pet food — time for the next bag',
    },
    {
      tagName: 'Festive & Dry Fruits',
      ruleName: 'Festive dry fruits · yearly',
      triggerDays: 350,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'fresh dry fruits & festive hampers',
    },
  ],
};
