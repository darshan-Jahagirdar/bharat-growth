import { describe, expect, it } from 'vitest';
import { calculateTotals, type LineItemInput } from '../calculateTotals';

function line(overrides: Partial<LineItemInput> = {}): LineItemInput {
  return {
    productName: 'Test product',
    hsnCode: '1001',
    quantity: 1,
    unitPricePaise: 10_000,
    gstRatePercent: 18,
    discountPaise: 0,
    unit: 'piece',
    ...overrides,
  };
}

describe('calculateTotals behavior contract', () => {
  it.each([
    [0, 0],
    [5, 500],
    [12, 1_200],
    [18, 1_800],
    [28, 2_800],
  ] as const)('calculates the %s%% GST slab in paise', (rate, expectedTax) => {
    const result = calculateTotals([line({ gstRatePercent: rate })], 'regular', false);

    expect(result.cgstTotalPaise + result.sgstTotalPaise).toBe(expectedTax);
    expect(result.totalPaise).toBe(10_000 + expectedTax);
  });

  it('splits intra-state GST without losing a rounding remainder', () => {
    const result = calculateTotals(
      [line({ unitPricePaise: 101, gstRatePercent: 5 })],
      'regular',
      false
    );

    expect(result.cgstTotalPaise).toBe(3);
    expect(result.sgstTotalPaise).toBe(2);
    expect(result.igstTotalPaise).toBe(0);
  });

  it('uses IGST for inter-state invoices', () => {
    const result = calculateTotals([line()], 'regular', true);

    expect(result.cgstTotalPaise).toBe(0);
    expect(result.sgstTotalPaise).toBe(0);
    expect(result.igstTotalPaise).toBe(1_800);
  });

  it('creates a tax-free bill of supply for composition shops', () => {
    const result = calculateTotals([line()], 'composition', false);

    expect(result.documentType).toBe('bill_of_supply');
    expect(result.cgstTotalPaise + result.sgstTotalPaise + result.igstTotalPaise).toBe(0);
    expect(result.totalPaise).toBe(10_000);
  });

  it('preserves fractional quantities using paise rounding', () => {
    const result = calculateTotals(
      [line({ quantity: 0.5, unitPricePaise: 19_900, gstRatePercent: 0 })],
      'regular',
      false
    );

    expect(result.subtotalPaise).toBe(9_950);
    expect(result.totalPaise).toBe(9_950);
  });

  it('clamps a line discount at zero taxable value', () => {
    const result = calculateTotals(
      [line({ unitPricePaise: 100, discountPaise: 150 })],
      'regular',
      false
    );

    expect(result.lineItems[0].taxableAmountPaise).toBe(0);
    expect(result.totalPaise).toBe(0);
  });
});
