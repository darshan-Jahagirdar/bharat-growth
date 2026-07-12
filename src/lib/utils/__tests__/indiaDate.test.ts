import { describe, expect, it } from 'vitest';
import { getIndiaDate, getIndianFinancialYear } from '../indiaDate';

describe('India business date helpers', () => {
  it('uses the next India date after the UTC boundary', () => {
    expect(getIndiaDate(new Date('2026-03-31T20:00:00.000Z'))).toBe('2026-04-01');
  });

  it('keeps the previous India date before midnight IST', () => {
    expect(getIndiaDate(new Date('2026-03-31T18:00:00.000Z'))).toBe('2026-03-31');
  });

  it('changes financial year on 1 April', () => {
    expect(getIndianFinancialYear('2026-03-31')).toBe('2025-26');
    expect(getIndianFinancialYear('2026-04-01')).toBe('2026-27');
  });

  it('rejects an invalid month', () => {
    expect(() => getIndianFinancialYear('2026-13-01')).toThrow('Invalid India date');
  });
});
