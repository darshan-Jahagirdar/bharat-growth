export interface SaveInvoiceParams {
  invoice: {
    shop_id: string;
    invoice_date: string;
    invoice_type: string;
    document_type: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_gstin: string | null;
    billing_state_code: string;
    is_inter_state: boolean;
    subtotal_paise: number;
    cgst_total_paise: number;
    sgst_total_paise: number;
    igst_total_paise: number;
    discount_paise: number;
    round_off_paise: number;
    total_paise: number;
    payment_mode: string;
    payment_reference?: string | null;
    created_by: string | null;
  };
  items: Array<{
    product_id: string | null;
    product_name: string;
    hsn_code: string;
    quantity: number;
    unit: string;
    unit_price_paise: number;
    discount_paise: number;
    taxable_amount_paise: number;
    gst_rate_percent: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    total_paise: number;
    batch_number?: string | null;
  }>;
  loyaltyEntry?: {
    customer_id: string;
    entry_type: string;
    points: number;
    running_balance: number;
    description?: string;
  } | null;
}

export interface SaveInvoiceResult {
  invoice_id: string;
  invoice_number: string;
  invoice_sequence: number;
  financial_year: string;
  total_paise: number;
}
