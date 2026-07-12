import type { CreateSOParams } from '@/lib/orders/orderQueries';
import type { SaveInvoiceParams } from './billingQueries';
import type { BillingState } from './useBillingStore';

/**
 * Build the exact payload expected by the atomic save_invoice RPC.
 *
 * Keep this transformation free of network and UI concerns so its paise values,
 * item ordering, customer snapshot, and loyalty rules can be regression tested.
 */
export function buildInvoiceSaveParams(
  state: BillingState,
  shopId: string,
  invoiceDate: string
): SaveInvoiceParams {
  const invoice: SaveInvoiceParams['invoice'] = {
    shop_id: shopId,
    invoice_date: invoiceDate,
    invoice_type: 'regular',
    document_type: state.totals.documentType,
    customer_id: state.customer?.id ?? null,
    customer_name: state.customer?.name ?? null,
    customer_phone: state.customer?.phoneNumber ?? null,
    customer_gstin: state.customer?.gstin ?? null,
    billing_state_code: state.shopStateCode,
    is_inter_state: state.isInterState,
    subtotal_paise: state.totals.subtotalPaise,
    cgst_total_paise: state.totals.cgstTotalPaise,
    sgst_total_paise: state.totals.sgstTotalPaise,
    igst_total_paise: state.totals.igstTotalPaise,
    discount_paise: state.totals.discountPaise,
    round_off_paise: state.totals.roundOffPaise,
    total_paise: state.totals.totalPaise,
    payment_mode: state.paymentMode,
    payment_reference: null,
    created_by: null,
  };

  const items: SaveInvoiceParams['items'] = state.totals.lineItems.map((computed, index) => ({
    product_id: state.lineItems[index].productId,
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
    batch_number: null,
  }));

  const loyaltyEntry: SaveInvoiceParams['loyaltyEntry'] = state.customer
    ? {
        customer_id: state.customer.id,
        entry_type: 'earn',
        points: Math.floor(state.totals.totalPaise / 10_000),
        running_balance:
          state.customer.loyaltyPoints + Math.floor(state.totals.totalPaise / 10_000),
        description: undefined,
      }
    : null;

  return { invoice, items, loyaltyEntry };
}

/** Build the existing create_sales_order RPC input from a validated POS cart. */
export function buildSalesOrderParams(
  state: BillingState,
  shopId: string,
  createdBy: string | undefined
): CreateSOParams {
  return {
    shopId,
    customerId: state.customer?.id ?? null,
    totalAmountPaise: state.totals.totalPaise,
    createdBy,
    items: state.lineItems.flatMap((lineItem, index) => {
      if (!lineItem.productId) return [];

      return [{
        productId: lineItem.productId,
        quantity: state.totals.lineItems[index]?.quantity ?? lineItem.quantity,
        agreedPricePaise: lineItem.unitPricePaise,
      }];
    }),
  };
}
