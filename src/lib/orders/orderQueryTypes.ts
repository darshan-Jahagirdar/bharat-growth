export interface PurchaseOrderRow {
  id: string;
  po_number: string;
  po_sequence: number;
  financial_year: string;
  supplier_name: string;
  status: string;
  expected_date: string | null;
  total_amount_paise: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItemRow[];
}

export interface PurchaseOrderItemRow {
  id: string;
  product_id: string | null;
  quantity: number;
  expected_price_paise: number;
  product_name: string | null;
  product_unit: string | null;
}

export interface SalesOrderRow {
  id: string;
  so_number: string;
  so_sequence: number;
  financial_year: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  valid_until: string | null;
  total_amount_paise: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: SalesOrderItemRow[];
}

export interface SalesOrderItemRow {
  id: string;
  product_id: string | null;
  quantity: number;
  agreed_price_paise: number;
  product_name: string | null;
  product_unit: string | null;
}

export interface ConvertResult {
  success: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface FetchResult<T> {
  rows: T[];
  hasMore: boolean;
}

export interface CreateSOParams {
  shopId: string;
  customerId: string | null;
  totalAmountPaise: number;
  notes?: string;
  createdBy?: string;
  items: {
    productId: string;
    quantity: number;
    agreedPricePaise: number;
  }[];
}

export interface CreatePOParams {
  shopId: string;
  supplierName: string;
  expectedDate?: string;
  totalAmountPaise: number;
  notes?: string;
  createdBy?: string;
  items: {
    productId: string;
    quantity: number;
    expectedPricePaise: number;
  }[];
}
