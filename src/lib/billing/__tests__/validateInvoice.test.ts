import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../calculateTotals';
import type { BillingState } from '../useBillingStore';
import { validateBillingState } from '../validateInvoice';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';

function billingState(): BillingState {
  const input = {
    productName: 'Test product',
    hsnCode: '4011',
    quantity: 1,
    unitPricePaise: 10_000,
    gstRatePercent: 18 as const,
    discountPaise: 0,
    unit: 'piece',
  };

  return {
    customer: null,
    lineItems: [
      {
        id: 'line-1',
        productId: PRODUCT_ID,
        ...input,
        barcode: null,
      },
    ],
    activeLineIndex: 0,
    paymentMode: 'cash',
    invoiceLevelDiscountPaise: 0,
    isInterState: false,
    gstType: 'regular',
    shopStateCode: '27',
    totals: calculateTotals([input], 'regular', false),
  };
}

describe('validateBillingState behavior contract', () => {
  it('builds a valid invoice payload with paise totals', () => {
    const result = validateBillingState(
      billingState(),
      SHOP_ID,
      '2026-27',
      'INV-1',
      1,
      null
    );

    expect(result.valid).toBe(true);
    expect(result.invoiceData?.total_paise).toBe(11_800);
    expect(result.itemsData?.[0].product_id).toBe(PRODUCT_ID);
  });

  it('rejects an empty bill before building a payload', () => {
    const state = billingState();
    state.lineItems = [];
    state.totals = calculateTotals([], 'regular', false);

    const result = validateBillingState(state, SHOP_ID, '2026-27', 'INV-1', 1, null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Add at least one item to the bill');
  });

  it('rejects non-positive quantity', () => {
    const state = billingState();
    state.lineItems[0].quantity = 0;

    const result = validateBillingState(state, SHOP_ID, '2026-27', 'INV-1', 1, null);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/quantity must be > 0/);
  });
});
