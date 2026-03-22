// =============================================================================
// BharatGrowth — Invoice Validation (Zod integration)
// Validates billing state before Supabase submission
// =============================================================================

import { z } from 'zod';
import {
  invoiceCreateSchema,
  invoiceItemCreateSchema,
  phoneSchema,
} from '@/lib/validators/schema';
import type { BillingState } from './useBillingStore';
import type { InvoiceTotals } from './calculateTotals';

// ── Validation result ──

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  invoiceData?: z.infer<typeof invoiceCreateSchema>;
  itemsData?: z.infer<typeof invoiceItemCreateSchema>[];
}

// ── Validate the full billing state before submission ──

export function validateBillingState(
  state: BillingState,
  shopId: string,
  financialYear: string,
  invoiceNumber: string,
  invoiceSequence: number,
  createdBy: string
): ValidationResult {
  const errors: string[] = [];

  // Must have at least one line item
  if (state.lineItems.length === 0) {
    errors.push('Add at least one item to the bill');
  }

  // Validate customer phone if customer is set
  if (state.customer) {
    const phoneResult = phoneSchema.safeParse(state.customer.phoneNumber);
    if (!phoneResult.success) {
      errors.push('Invalid customer phone number');
    }
  }

  // Validate each line item quantity
  state.lineItems.forEach((item, i) => {
    if (item.quantity <= 0) {
      errors.push(`Item ${i + 1} (${item.productName}): quantity must be > 0`);
    }
    if (item.unitPricePaise < 0) {
      errors.push(`Item ${i + 1} (${item.productName}): price cannot be negative`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build invoice data from billing state
  const totals = state.totals;

  const invoiceData = {
    shop_id: shopId,
    invoice_number: invoiceNumber,
    invoice_sequence: invoiceSequence,
    financial_year: financialYear,
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_type: 'regular' as const,
    document_type: totals.documentType,
    customer_id: state.customer?.id ?? null,
    customer_name: state.customer?.name ?? null,
    customer_phone: state.customer?.phoneNumber ?? null,
    customer_gstin: state.customer?.gstin ?? null,
    billing_state_code: state.shopStateCode,
    is_inter_state: state.isInterState,
    subtotal_paise: totals.subtotalPaise,
    cgst_total_paise: totals.cgstTotalPaise,
    sgst_total_paise: totals.sgstTotalPaise,
    igst_total_paise: totals.igstTotalPaise,
    discount_paise: totals.discountPaise,
    round_off_paise: totals.roundOffPaise,
    total_paise: totals.totalPaise,
    payment_mode: state.paymentMode,
    status: 'completed' as const,
    created_by: createdBy,
  };

  // Validate invoice through Zod
  const invoiceResult = invoiceCreateSchema.safeParse(invoiceData);
  if (!invoiceResult.success) {
    invoiceResult.error.errors.forEach((err) => {
      errors.push(`Invoice: ${err.path.join('.')} — ${err.message}`);
    });
    return { valid: false, errors };
  }

  // Build and validate line items
  const itemsData = state.totals.lineItems.map((computed, i) => {
    const lineItem = state.lineItems[i];
    return {
      shop_id: shopId,
      invoice_id: '00000000-0000-0000-0000-000000000000', // Placeholder — set after invoice insert
      product_id: lineItem.productId,
      product_name: computed.productName,
      hsn_code: computed.hsnCode,
      quantity: computed.quantity,
      unit: computed.unit,
      unit_price_paise: computed.unitPricePaise,
      discount_paise: computed.discountPaise,
      taxable_amount_paise: computed.taxableAmountPaise,
      gst_rate_percent: computed.gstRatePercent,
      cgst_paise: computed.cgstPaise,
      sgst_paise: computed.sgstPaise,
      igst_paise: computed.igstPaise,
      total_paise: computed.totalPaise,
    };
  });

  for (let i = 0; i < itemsData.length; i++) {
    const itemResult = invoiceItemCreateSchema.safeParse(itemsData[i]);
    if (!itemResult.success) {
      itemResult.error.errors.forEach((err) => {
        errors.push(`Item ${i + 1}: ${err.path.join('.')} — ${err.message}`);
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    invoiceData: invoiceResult.data,
    itemsData,
  };
}
