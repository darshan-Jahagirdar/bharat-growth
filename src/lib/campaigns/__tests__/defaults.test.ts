import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMPAIGNS } from '../defaults';

describe('default campaign contracts', () => {
  it('provides at least one inactive-by-default seed definition per business type', () => {
    for (const campaigns of Object.values(DEFAULT_CAMPAIGNS)) {
      expect(campaigns.length).toBeGreaterThan(0);
    }
  });

  it('keeps Meta custom variables within the database limit', () => {
    for (const campaign of Object.values(DEFAULT_CAMPAIGNS).flat()) {
      expect(campaign.customVariable.length).toBeLessThanOrEqual(60);
      expect(campaign.triggerDays).toBeGreaterThan(0);
    }
  });
});
