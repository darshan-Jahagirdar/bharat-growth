// =============================================================================
// BharatGrowth — Database TypeScript Types
// Auto-generated from schema.sql — keep in sync with migrations
// =============================================================================

// ── Enums ──

export type BusinessType = 'tyre_shop' | 'sweet_stall' | 'garment_store' | 'grocery' | 'general';
export type GstType = 'regular' | 'composition';
export type ThemePreference = 'modern' | 'festive' | 'industrial';
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type UserRole = 'owner' | 'manager' | 'cashier';
export type CustomerSegment = 'new' | 'regular' | 'vip' | 'dormant';
export type GstRatePercent = 0 | 5 | 12 | 18 | 28;
export type ProductUnit = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'metre' | 'set' | 'pair' | 'box';
export type InvoiceType = 'regular' | 'credit_note' | 'debit_note' | 'proforma';
export type DocumentType = 'tax_invoice' | 'bill_of_supply';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'split' | 'online_upi' | 'online_khata';
export type InvoiceStatus = 'draft' | 'completed' | 'cancelled' | 'returned' | 'pending_online';
export type LoyaltyEntryType = 'earn' | 'redeem' | 'expire' | 'adjust';
export type ConsentPurpose = 'data_collection' | 'whatsapp_marketing' | 'data_sharing' | 'analytics' | 'erasure_request';
export type ConsentStatus = 'granted' | 'withdrawn';
export type ConsentMethod = 'in_app' | 'whatsapp_opt_in' | 'verbal_recorded' | 'sms' | 'paper';
export type CreditTransactionType = 'credit_given' | 'payment_received';
export type MovementType = 'sale' | 'purchase' | 'return' | 'adjustment' | 'damage' | 'expired';
export type ReferenceType = 'invoice' | 'purchase_order' | 'purchase_bill' | 'manual';

// ── Vertical-specific product attributes ──

export interface TyreAttrs {
  brand: string;
  size: string;
  type?: 'tubeless' | 'tube' | 'radial';
  vehicle_type?: string;
}

export interface SweetAttrs {
  weight_g: number;
  is_perishable: boolean;
  shelf_life_days?: number;
}

export interface GarmentAttrs {
  size: string;
  color: string;
  fabric?: string;
  gender?: 'men' | 'women' | 'kids' | 'unisex';
}

export type VerticalAttrs = TyreAttrs | SweetAttrs | GarmentAttrs | Record<string, unknown>;

// ── Table Row Types ──

export interface Shop {
  id: string;
  business_name: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  gst_type: GstType;
  business_type: BusinessType;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_code: string;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  subscription_plan: SubscriptionPlan;
  subscription_valid_until: string | null;
  e_invoicing_enabled: boolean;
  upi_id: string | null;
  theme_preference: ThemePreference;
  primary_color: string;
  monthly_ai_scans: number;
  campaigns_approved: boolean;
  campaigns_approved_at: string | null;
  campaigns_approval_requested_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  sku: string | null;
  hsn_code: string;
  gst_rate_percent: GstRatePercent;
  unit_price_paise: number;
  selling_price_paise: number;
  unit: ProductUnit;
  category: string | null;
  /** Bring-Back campaign tag (tags.id) — drives repurchase-cycle reminders */
  tag_id: string | null;
  is_active: boolean;
  barcode: string | null;
  vertical_attrs: VerticalAttrs;
  image_url: string | null;
  is_stock_tracked: boolean;
  low_stock_threshold: number;
  purchase_price_paise: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  segment: CustomerSegment;
  total_spent_paise: number;
  visit_count: number;
  last_visit_at: string | null;
  dpdp_data_consent: boolean;
  dpdp_marketing_consent: boolean;
  dpdp_data_sharing_consent: boolean;
  consent_collected_at: string | null;
  photo_url: string | null;
  credit_balance_paise: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerVisit {
  id: string;
  shop_id: string;
  customer_id: string;
  tag_id: string | null;
  request_id: string | null;
  visit_date: string;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  shop_id: string;
  customer_id: string;
  invoice_id: string | null;
  amount_paise: number;
  transaction_type: CreditTransactionType;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  shop_id: string;
  invoice_number: string;
  invoice_sequence: number;
  financial_year: string;
  invoice_date: string;
  invoice_type: InvoiceType;
  document_type: DocumentType;
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
  payment_mode: PaymentMode;
  payment_reference: string | null;
  delivery_address: string | null;
  status: InvoiceStatus;
  irn: string | null;
  irn_generated_at: string | null;
  original_invoice_id: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  shop_id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price_paise: number;
  discount_paise: number;
  taxable_amount_paise: number;
  gst_rate_percent: GstRatePercent;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  batch_number: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  shop_id: string;
  customer_id: string;
  invoice_id: string | null;
  entry_type: LoyaltyEntryType;
  points: number;
  running_balance: number;
  description: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentLog {
  id: string;
  shop_id: string;
  customer_id: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  consent_method: ConsentMethod;
  ip_address: string | null;
  user_agent: string | null;
  collected_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MessageLog {
  id: string;
  shop_id: string;
  customer_id: string;
  invoice_id: string | null;
  visit_id: string | null;
  rule_id: string;
  sent_at: string;
  converted_at: string | null;
  conversion_invoice_id: string | null;
  conversion_visit_id: string | null;
}

export interface InventoryRecord {
  id: string;
  shop_id: string;
  product_id: string;
  batch_number: string | null;
  quantity_in_stock: number;
  reorder_level: number | null;
  cost_price_paise: number | null;
  expiry_date: string | null;
  manufacturing_date: string | null;
  location: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  shop_id: string;
  inventory_id: string;
  movement_type: MovementType;
  quantity_change: number;
  quantity_after: number;
  reference_id: string | null;
  reference_type: ReferenceType | null;
  reason: string | null;
  total_value_paise: number;
  purchase_bill_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PurchaseBill {
  id: string;
  shop_id: string;
  supplier_name: string;
  bill_number: string | null;
  bill_date: string;
  total_amount_paise: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Platform Access Approval ──

export type AccessRequestStatus = 'pending' | 'approved' | 'dismissed';

export interface AccessRequest {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string;
  business_type: BusinessType;
  city: string;
  email: string;
  status: AccessRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
}

// ── Order Engine Types (Phase 29) ──

export type PurchaseOrderStatus = 'draft' | 'sent' | 'fulfilled' | 'cancelled';
export type SalesOrderStatus = 'draft' | 'reserved' | 'fulfilled' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  shop_id: string;
  po_number: string;
  po_sequence: number;
  financial_year: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  total_amount_paise: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  shop_id: string;
  po_id: string;
  product_id: string | null;
  quantity: number;
  expected_price_paise: number;
  created_at: string;
  updated_at: string;
}

export interface SalesOrder {
  id: string;
  shop_id: string;
  so_number: string;
  so_sequence: number;
  financial_year: string;
  customer_id: string | null;
  status: SalesOrderStatus;
  valid_until: string | null;
  total_amount_paise: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderItem {
  id: string;
  shop_id: string;
  so_id: string;
  product_id: string | null;
  quantity: number;
  agreed_price_paise: number;
  created_at: string;
  updated_at: string;
}

// ── Insert types (omit server-generated fields) ──

export type ShopInsert = Omit<Shop, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type UserInsert = Omit<User, 'created_at' | 'updated_at' | 'last_login_at'>;
export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'total_spent_paise' | 'visit_count' | 'last_visit_at'> & { id?: string };
export type CustomerVisitInsert = Omit<CustomerVisit, 'id' | 'visit_date' | 'created_at'> & {
  id?: string;
  visit_date?: string;
};
export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & { id?: string };
export type InvoiceItemInsert = Omit<InvoiceItem, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & { id?: string };
export type LoyaltyLedgerInsert = Omit<LoyaltyLedgerEntry, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & { id?: string };
export type ConsentLogInsert = Omit<ConsentLog, 'id' | 'created_at'> & { id?: string };
type MessageLogInsertBase = Omit<
  MessageLog,
  | 'id'
  | 'invoice_id'
  | 'visit_id'
  | 'sent_at'
  | 'converted_at'
  | 'conversion_invoice_id'
  | 'conversion_visit_id'
> & {
  id?: string;
  sent_at?: string;
  converted_at?: string | null;
  conversion_invoice_id?: string | null;
  conversion_visit_id?: string | null;
};
export type MessageLogInsert = MessageLogInsertBase & (
  | { invoice_id: string; visit_id?: null }
  | { invoice_id?: null; visit_id: string }
);
export type InventoryInsert = Omit<InventoryRecord, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type InventoryMovementInsert = Omit<InventoryMovement, 'id' | 'created_at'> & { id?: string };
export type CreditLedgerInsert = Omit<CreditLedgerEntry, 'id' | 'created_at'> & { id?: string };
export type PurchaseBillInsert = Omit<PurchaseBill, 'id' | 'created_at' | 'updated_at'> & { id?: string };

// ── Paise ↔ Rupee helpers ──

export const paiseToRupees = (paise: number): number => paise / 100;
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

/** Format paise as Indian currency string: ₹1,23,456.78 */
export const formatINR = (paise: number): string => {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
};
