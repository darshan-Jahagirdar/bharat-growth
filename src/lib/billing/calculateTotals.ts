// =============================================================================
// BharatGrowth — GST Billing Calculation Engine
// Handles both Regular (Tax Invoice) and Composition (Bill of Supply) shops
// All amounts in paise (integer) — never float for money
// =============================================================================

import type { GstType, GstRatePercent } from '@/lib/types/database';

// ── Line Item Input ──

export interface LineItemInput {
  productName: string;
  hsnCode: string;
  quantity: number;
  unitPricePaise: number;
  gstRatePercent: GstRatePercent;
  discountPaise: number;
  unit: string;
}

// ── Computed Line Item Output ──

export interface LineItemComputed extends LineItemInput {
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

// ── Invoice Totals ──

export interface InvoiceTotals {
  subtotalPaise: number;
  cgstTotalPaise: number;
  sgstTotalPaise: number;
  igstTotalPaise: number;
  discountPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  documentType: 'tax_invoice' | 'bill_of_supply';
  lineItems: LineItemComputed[];
}

// ── Core: Compute a single line item's tax ──

function computeLineItem(
  item: LineItemInput,
  gstType: GstType,
  isInterState: boolean
): LineItemComputed {
  // taxable = (quantity × unit_price) − discount
  const grossPaise = Math.round(item.quantity * item.unitPricePaise);
  const taxableAmountPaise = Math.max(0, grossPaise - item.discountPaise);

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  // Composition scheme: Bill of Supply — NO tax breakup
  if (gstType === 'regular' && item.gstRatePercent > 0) {
    if (isInterState) {
      // Inter-state: full IGST
      igstPaise = Math.round(taxableAmountPaise * item.gstRatePercent / 100);
    } else {
      // Intra-state: split into CGST + SGST with remainder-based rounding
      const totalGstPaise = Math.round(taxableAmountPaise * item.gstRatePercent / 100);
      cgstPaise = Math.round(totalGstPaise / 2);
      sgstPaise = totalGstPaise - cgstPaise;
    }
  }

  const totalPaise = taxableAmountPaise + cgstPaise + sgstPaise + igstPaise;

  return {
    ...item,
    taxableAmountPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise,
  };
}

// ── Round to nearest rupee (Indian billing practice) ──

function computeRoundOff(): number {
  // No rounding — exact paise amounts required for UPI and Quick Commerce
  return 0;
}

// ── Main: Calculate full invoice totals ──

export function calculateTotals(
  items: LineItemInput[],
  gstType: GstType,
  isInterState: boolean,
  invoiceLevelDiscountPaise: number = 0
): InvoiceTotals {
  const lineItems = items.map((item) => computeLineItem(item, gstType, isInterState));

  const subtotalPaise = lineItems.reduce((sum, li) => sum + li.taxableAmountPaise, 0);
  const cgstTotalPaise = lineItems.reduce((sum, li) => sum + li.cgstPaise, 0);
  const sgstTotalPaise = lineItems.reduce((sum, li) => sum + li.sgstPaise, 0);
  const igstTotalPaise = lineItems.reduce((sum, li) => sum + li.igstPaise, 0);

  const totalBeforeRounding =
    subtotalPaise + cgstTotalPaise + sgstTotalPaise + igstTotalPaise - invoiceLevelDiscountPaise;

  const roundOffPaise = computeRoundOff();
  const totalPaise = totalBeforeRounding + roundOffPaise;

  return {
    subtotalPaise,
    cgstTotalPaise,
    sgstTotalPaise,
    igstTotalPaise,
    discountPaise: invoiceLevelDiscountPaise,
    roundOffPaise,
    totalPaise,
    documentType: gstType === 'composition' ? 'bill_of_supply' : 'tax_invoice',
    lineItems,
  };
}
