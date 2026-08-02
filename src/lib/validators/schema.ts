// =============================================================================
// BharatGrowth — Zod Validation Schemas
// Runtime validation at API boundaries — matches database.ts types
// =============================================================================

import { z } from 'zod';

// ── Shared Enums ──

export const businessTypeEnum = z.enum(['tyre_shop', 'sweet_stall', 'garment_store', 'grocery', 'general']);
export const gstTypeEnum = z.enum(['regular', 'composition']);
export const subscriptionPlanEnum = z.enum(['free', 'pro', 'enterprise']);
export const userRoleEnum = z.enum(['owner', 'manager', 'cashier']);
export const customerSegmentEnum = z.enum(['new', 'regular', 'vip', 'dormant']);
export const gstRatePercentEnum = z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]);
export const productUnitEnum = z.enum(['piece', 'kg', 'g', 'litre', 'ml', 'metre', 'set', 'pair', 'box']);
export const invoiceTypeEnum = z.enum(['regular', 'credit_note', 'debit_note', 'proforma']);
export const documentTypeEnum = z.enum(['tax_invoice', 'bill_of_supply']);
export const paymentModeEnum = z.enum(['cash', 'upi', 'card', 'credit', 'split', 'online_upi', 'online_khata']);
export const invoiceStatusEnum = z.enum(['draft', 'completed', 'cancelled', 'returned', 'pending_online']);
export const loyaltyEntryTypeEnum = z.enum(['earn', 'redeem', 'expire', 'adjust']);
export const consentPurposeEnum = z.enum(['data_collection', 'whatsapp_marketing', 'data_sharing', 'analytics', 'erasure_request']);
export const consentStatusEnum = z.enum(['granted', 'withdrawn']);
export const consentMethodEnum = z.enum(['in_app', 'whatsapp_opt_in', 'verbal_recorded', 'sms', 'paper']);
export const movementTypeEnum = z.enum(['sale', 'purchase', 'return', 'adjustment', 'damage', 'expired']);

// ── Shared Validators ──

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** GSTIN mod-36 checksum defined over the first 14 characters. */
export function hasValidGstinChecksum(gstin: string): boolean {
  if (!GSTIN_FORMAT.test(gstin)) return false;

  let factor = 2;
  let sum = 0;

  for (let index = 13; index >= 0; index -= 1) {
    const codePoint = GSTIN_ALPHABET.indexOf(gstin[index]);
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + (addend % 36);
  }

  const checkCodePoint = (36 - (sum % 36)) % 36;
  return gstin[14] === GSTIN_ALPHABET[checkCodePoint];
}

/** GSTIN: 15-character format plus mod-36 checksum. */
export const gstinSchema = z
  .string()
  .regex(GSTIN_FORMAT, 'Invalid GSTIN format')
  .refine(hasValidGstinChecksum, 'Invalid GSTIN checksum');

/** Indian phone number: +91XXXXXXXXXX or 10-digit */
export const phoneSchema = z.string().regex(
  /^(\+91)?[6-9]\d{9}$/,
  'Invalid Indian phone number'
);

/** HSN code: 4, 6, or 8 digits */
export const hsnCodeSchema = z.string().regex(/^\d{4}(\d{2})?(\d{2})?$/, 'HSN must be 4, 6, or 8 digits');

/** Paise: non-negative integer */
export const paiseSchema = z.number().int().nonnegative();

/** Indian state code: 01-37 */
export const stateCodeSchema = z.string().regex(/^(0[1-9]|[1-2]\d|3[0-7])$/, 'Invalid GST state code');

// ── Vertical-Specific Product Attributes ──

export const tyreAttrsSchema = z.object({
  brand: z.string().min(1),
  size: z.string().min(1),
  type: z.enum(['tubeless', 'tube', 'radial']).optional(),
  vehicle_type: z.string().optional(),
});

export const sweetAttrsSchema = z.object({
  weight_g: z.number().positive(),
  is_perishable: z.boolean(),
  shelf_life_days: z.number().int().positive().optional(),
});

export const garmentAttrsSchema = z.object({
  size: z.string().min(1),
  color: z.string().min(1),
  fabric: z.string().optional(),
  gender: z.enum(['men', 'women', 'kids', 'unisex']).optional(),
});

// ── Table Schemas (for API validation) ──

export const shopCreateSchema = z.object({
  business_name: z.string().min(1).max(200),
  legal_name: z.string().nullable().optional(),
  gstin: gstinSchema.nullable().optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN').nullable().optional(),
  gst_type: gstTypeEnum.default('regular'),
  business_type: businessTypeEnum,
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state_code: stateCodeSchema,
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  email: z.string().email().nullable().optional(),
});

export const userCreateSchema = z.object({
  id: z.string().uuid(),
  shop_id: z.string().uuid(),
  full_name: z.string().min(1).max(100),
  phone: phoneSchema.nullable().optional(),
  role: userRoleEnum,
});

export const productCreateSchema = z.object({
  shop_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  sku: z.string().nullable().optional(),
  hsn_code: hsnCodeSchema,
  gst_rate_percent: gstRatePercentEnum,
  unit_price_paise: paiseSchema,
  selling_price_paise: paiseSchema,
  unit: productUnitEnum.default('piece'),
  category: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  vertical_attrs: z.union([tyreAttrsSchema, sweetAttrsSchema, garmentAttrsSchema, z.record(z.unknown())]).default({}),
});

export const customerCreateSchema = z.object({
  shop_id: z.string().uuid(),
  phone_number: phoneSchema,
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  gstin: gstinSchema.nullable().optional(),
  dpdp_data_consent: z.boolean().default(false),
  dpdp_marketing_consent: z.boolean().default(false),
  dpdp_data_sharing_consent: z.boolean().default(false),
});

export const invoiceCreateSchema = z.object({
  shop_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  invoice_sequence: z.number().int().positive(),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-YY'),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoice_type: invoiceTypeEnum.default('regular'),
  document_type: documentTypeEnum.default('tax_invoice'),
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  customer_gstin: gstinSchema.nullable().optional(),
  billing_state_code: stateCodeSchema,
  is_inter_state: z.boolean().default(false),
  subtotal_paise: paiseSchema,
  cgst_total_paise: paiseSchema.default(0),
  sgst_total_paise: paiseSchema.default(0),
  igst_total_paise: paiseSchema.default(0),
  discount_paise: paiseSchema.default(0),
  round_off_paise: z.number().int().default(0),
  total_paise: paiseSchema,
  payment_mode: paymentModeEnum.default('cash'),
  payment_reference: z.string().nullable().optional(),
  delivery_address: z.string().nullable().optional(),
  status: invoiceStatusEnum.default('completed'),
  created_by: z.string().uuid().nullable().optional(),
});

export const invoiceItemCreateSchema = z.object({
  shop_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1),
  hsn_code: hsnCodeSchema,
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unit_price_paise: paiseSchema,
  discount_paise: paiseSchema.default(0),
  taxable_amount_paise: paiseSchema,
  gst_rate_percent: gstRatePercentEnum,
  cgst_paise: paiseSchema.default(0),
  sgst_paise: paiseSchema.default(0),
  igst_paise: paiseSchema.default(0),
  total_paise: paiseSchema,
  batch_number: z.string().nullable().optional(),
});

export const loyaltyEntryCreateSchema = z.object({
  shop_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  entry_type: loyaltyEntryTypeEnum,
  points: z.number().int(),
  running_balance: z.number().int().nonnegative(),
  description: z.string().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export const consentLogCreateSchema = z.object({
  shop_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  purpose: consentPurposeEnum,
  status: consentStatusEnum,
  consent_method: consentMethodEnum,
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  collected_by: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const inventoryCreateSchema = z.object({
  shop_id: z.string().uuid(),
  product_id: z.string().uuid(),
  batch_number: z.string().nullable().optional(),
  quantity_in_stock: z.number().nonnegative().default(0),
  reorder_level: z.number().nonnegative().nullable().optional(),
  cost_price_paise: paiseSchema.nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  manufacturing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  supplier_phone: phoneSchema.nullable().optional(),
});

// ── Export inferred types ──

export type ShopCreate = z.infer<typeof shopCreateSchema>;
export type UserCreate = z.infer<typeof userCreateSchema>;
export type ProductCreate = z.infer<typeof productCreateSchema>;
export type CustomerCreate = z.infer<typeof customerCreateSchema>;
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
export type InvoiceItemCreate = z.infer<typeof invoiceItemCreateSchema>;
export type LoyaltyEntryCreate = z.infer<typeof loyaltyEntryCreateSchema>;
export type ConsentLogCreate = z.infer<typeof consentLogCreateSchema>;
export type InventoryCreate = z.infer<typeof inventoryCreateSchema>;
