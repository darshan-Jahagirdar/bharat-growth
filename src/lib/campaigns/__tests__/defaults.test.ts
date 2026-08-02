import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMPAIGNS } from '../defaults';

function campaignTuple(campaign: (typeof DEFAULT_CAMPAIGNS)[keyof typeof DEFAULT_CAMPAIGNS][number]) {
  return [
    campaign.tagName,
    campaign.ruleName,
    campaign.triggerDays,
    campaign.templateKey,
    campaign.customVariable,
  ];
}

const EXPECTED_RULES = {
  tyre_shop: [
    ['Tyres', 'Free alignment check · 6 months', 180, 'RESTOCK', 'a free wheel alignment & rotation check'],
    ['Tyres', 'Tyre replacement due · 3 years', 1100, 'RESTOCK', 'new tyres — it has been about 3 years'],
    ['Battery', 'Battery health check · 3 years', 1050, 'RESTOCK', 'a free battery health check'],
    ['Engine Oil', 'Oil change due · 6 months', 180, 'RESTOCK', 'an engine oil change — about 6 months due'],
    ['Filters', 'Filter change due · 6 months', 180, 'RESTOCK', 'an air & oil filter change'],
    ['Brake Pads', 'Brake inspection · yearly', 365, 'RESTOCK', 'a brake inspection — a year since last time'],
    ['Coolant', 'Coolant top-up · yearly', 365, 'RESTOCK', 'a coolant top-up before the summer heat'],
    ['Wipers', 'Wiper replacement · 10 months', 300, 'RESTOCK', 'new wiper blades before the monsoon'],
  ],
  sweet_stall: [
    ['Sweets', 'Fresh sweets nudge · 25 days', 25, 'RESTOCK', 'fresh sweets, made today'],
    ['Gift Boxes', 'Festive gift boxes · yearly', 350, 'NEW_ARRIVAL', 'festive gift boxes for the season'],
    ['Namkeen', 'Fresh namkeen nudge · 20 days', 20, 'RESTOCK', 'fresh namkeen & savouries'],
    ['Dry Fruits', 'Dry fruits restock · 3 months', 90, 'RESTOCK', 'fresh dry fruits, newly stocked'],
    ['Cakes', 'Celebration cake · yearly', 365, 'NEW_ARRIVAL', 'a celebration cake — same time last year'],
    ['Festive Specials', 'Festive specials · yearly', 350, 'NEW_ARRIVAL', 'festive specials — made fresh this season'],
  ],
  garment_store: [
    ['Garments', 'New season collection · 6 months', 170, 'NEW_ARRIVAL', 'the new season collection'],
    ['School Uniforms', 'School uniform season · yearly', 365, 'NEW_ARRIVAL', 'school uniforms for the new academic year'],
    ['Kids Wear', 'Kids outgrow sizes · 4 months', 120, 'NEW_ARRIVAL', 'the next size up — kids grow fast'],
    ['Festive Wear', 'Festive collection · yearly', 350, 'NEW_ARRIVAL', 'festive collection for the season'],
    ['Winter Wear', 'Winter collection · yearly', 365, 'NEW_ARRIVAL', 'winter wear — sweaters, jackets & shawls'],
    ['Ethnic & Sarees', 'Wedding season ethnic · 6 months', 180, 'NEW_ARRIVAL', 'new ethnic wear for the wedding season'],
  ],
  general: [
    ['Regular Items', 'We miss you · 45 days', 45, 'PROMO', 'a special offer on your regulars'],
    ['Seasonal', 'Seasonal collection · yearly', 350, 'NEW_ARRIVAL', 'our new seasonal collection'],
  ],
  grocery: [
    ['Staples', 'Monthly staples restock · 30 days', 30, 'RESTOCK', 'your monthly rice, atta & dal restock'],
    ['Cooking Oil', 'Cooking oil restock · 30 days', 30, 'RESTOCK', 'cooking oil — about a month since last time'],
    ['Cleaning & Detergent', 'Cleaning supplies · 40 days', 40, 'RESTOCK', 'detergent & cleaning supplies'],
    ['Personal Care', 'Personal care restock · 45 days', 45, 'RESTOCK', 'soap, shampoo & daily essentials'],
    ['Baby Care', 'Baby care restock · 21 days', 21, 'RESTOCK', 'baby care essentials — diapers & formula'],
    ['Pet Food', 'Pet food restock · 30 days', 30, 'RESTOCK', 'pet food — time for the next bag'],
    ['Festive & Dry Fruits', 'Festive dry fruits · yearly', 350, 'NEW_ARRIVAL', 'fresh dry fruits & festive hampers'],
  ],
} as const;

describe('default campaign contracts', () => {
  it('provides at least one inactive-by-default seed definition per business type', () => {
    for (const campaigns of Object.values(DEFAULT_CAMPAIGNS)) {
      expect(campaigns.length).toBeGreaterThan(0);
    }
  });

  it.each(Object.entries(EXPECTED_RULES))(
    'seeds the exact %s tag and rule set',
    (businessType, expectedRules) => {
      const campaigns = DEFAULT_CAMPAIGNS[businessType as keyof typeof DEFAULT_CAMPAIGNS];

      expect(campaigns.map(campaignTuple)).toEqual(expectedRules);
    }
  );

  it.each([
    ['tyre_shop', 7, 8],
    ['grocery', 7, 7],
    ['garment_store', 6, 6],
    ['sweet_stall', 6, 6],
    ['general', 2, 2],
  ] as const)(
    '%s has the expected tag and rule cardinality',
    (businessType, expectedTags, expectedRules) => {
      const campaigns = DEFAULT_CAMPAIGNS[businessType];

      expect(new Set(campaigns.map((campaign) => campaign.tagName)).size).toBe(expectedTags);
      expect(campaigns).toHaveLength(expectedRules);
    }
  );

  it('keeps every legacy default definition unchanged', () => {
    expect(DEFAULT_CAMPAIGNS.tyre_shop.slice(0, 3)).toStrictEqual([
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
    ]);
    expect(DEFAULT_CAMPAIGNS.sweet_stall.slice(0, 2)).toStrictEqual([
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
    ]);
    expect(DEFAULT_CAMPAIGNS.garment_store[0]).toStrictEqual({
      tagName: 'Garments',
      ruleName: 'New season collection · 6 months',
      triggerDays: 170,
      templateKey: 'NEW_ARRIVAL',
      customVariable: 'the new season collection',
    });
    expect(DEFAULT_CAMPAIGNS.general[0]).toStrictEqual({
      tagName: 'Regular Items',
      ruleName: 'We miss you · 45 days',
      triggerDays: 45,
      templateKey: 'PROMO',
      customVariable: 'a special offer on your regulars',
    });
  });

  it('keeps Meta custom variables within the database limit', () => {
    for (const campaign of Object.values(DEFAULT_CAMPAIGNS).flat()) {
      expect(campaign.customVariable.length).toBeLessThanOrEqual(60);
      expect(campaign.triggerDays).toBeGreaterThan(0);
    }
  });
});
