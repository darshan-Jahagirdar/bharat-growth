import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../calculateTotals';
import { buildInvoiceSaveParams, buildSalesOrderParams } from '../buildBillingPayloads';
import type { BillingState } from '../useBillingStore';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';

function stateWithCustomer(): BillingState {
  const input = {
    productName: 'MRF Test Tyre',
    hsnCode: '4011',
    quantity: 2,
    unitPricePaise: 10_000,
    gstRatePercent: 18 as const,
    discountPaise: 500,
    unit: 'piece',
  };

  return {
    customer: {
      id: CUSTOMER_ID,
      phoneNumber: '9876543210',
      name: 'Test Customer',
      loyaltyPoints: 9,
      gstin: '27AAPFU0939F1ZV',
      segment: 'regular',
      creditBalancePaise: 2_000,
      photoUrl: null,
    },
    lineItems: [{
      id: 'line-1',
      productId: PRODUCT_ID,
      ...input,
      barcode: '1234567890',
    }],
    activeLineIndex: 0,
    paymentMode: 'credit',
    invoiceLevelDiscountPaise: 0,
    isInterState: false,
    gstType: 'regular',
    shopStateCode: '27',
    totals: calculateTotals([input], 'regular', false),
  };
}

describe('billing persistence payload behavior contract', () => {
  it('preserves the invoice RPC shape, paise totals, customer snapshot, and item order', () => {
    const state = stateWithCustomer();
    const result = buildInvoiceSaveParams(state, SHOP_ID, '2026-07-12');

    expect(result.invoice).toEqual({
      shop_id: SHOP_ID,
      invoice_date: '2026-07-12',
      invoice_type: 'regular',
      document_type: 'tax_invoice',
      customer_id: CUSTOMER_ID,
      customer_name: 'Test Customer',
      customer_phone: '9876543210',
      customer_gstin: '27AAPFU0939F1ZV',
      billing_state_code: '27',
      is_inter_state: false,
      subtotal_paise: 19_500,
      cgst_total_paise: 1_755,
      sgst_total_paise: 1_755,
      igst_total_paise: 0,
      discount_paise: 0,
      round_off_paise: 0,
      total_paise: 23_010,
      payment_mode: 'credit',
      payment_reference: null,
      created_by: null,
    });
    expect(result.items).toEqual([{
      product_id: PRODUCT_ID,
      product_name: 'MRF Test Tyre',
      hsn_code: '4011',
      quantity: 2,
      unit: 'piece',
      unit_price_paise: 10_000,
      discount_paise: 500,
      taxable_amount_paise: 19_500,
      gst_rate_percent: 18,
      cgst_paise: 1_755,
      sgst_paise: 1_755,
      igst_paise: 0,
      total_paise: 23_010,
      batch_number: null,
    }]);
  });

  it('earns loyalty points on the final total and keeps the previous running balance', () => {
    const result = buildInvoiceSaveParams(stateWithCustomer(), SHOP_ID, '2026-07-12');

    expect(result.loyaltyEntry).toEqual({
      customer_id: CUSTOMER_ID,
      entry_type: 'earn',
      points: 2,
      running_balance: 11,
      description: undefined,
    });
  });

  it('uses null customer fields and no loyalty entry for a walk-in sale', () => {
    const state = stateWithCustomer();
    state.customer = null;

    const result = buildInvoiceSaveParams(state, SHOP_ID, '2026-07-12');

    expect(result.invoice.customer_id).toBeNull();
    expect(result.invoice.customer_name).toBeNull();
    expect(result.invoice.customer_phone).toBeNull();
    expect(result.invoice.customer_gstin).toBeNull();
    expect(result.loyaltyEntry).toBeNull();
  });

  it('filters non-product rows and preserves computed quantity in the sales-order payload', () => {
    const state = stateWithCustomer();
    state.lineItems.push({
      ...state.lineItems[0],
      id: 'line-2',
      productId: null,
      productName: 'Manual line',
    });

    const result = buildSalesOrderParams(state, SHOP_ID, 'user-1');

    expect(result).toEqual({
      shopId: SHOP_ID,
      customerId: CUSTOMER_ID,
      totalAmountPaise: 23_010,
      createdBy: 'user-1',
      items: [{
        productId: PRODUCT_ID,
        quantity: 2,
        agreedPricePaise: 10_000,
      }],
    });
  });
});
