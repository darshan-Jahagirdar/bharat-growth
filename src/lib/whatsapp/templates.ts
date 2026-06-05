// =============================================================================
// BharatGrowth — Universal WhatsApp Template Registry
// Maps internal template keys to Meta-approved template names.
// All templates are vertical-agnostic (Tyres, Sweets, Garments, Hardware, etc.)
//
// Template Variable Order:
//   Each template defines an ordered list of body parameters that map
//   to {{1}}, {{2}}, {{3}}... in the Meta template body.
//   The variables array passed to sendTemplate() must match this order.
// =============================================================================

/** Meta-approved template names registered on WhatsApp Business Manager */
export const WA_TEMPLATES = {
  /** Post-purchase digital receipt link */
  RECEIPT: 'bg_receipt_v1',
  /** Khata (credit/udhaar) balance reminder */
  KHATA: 'bg_khata_v1',
  /** Restock / reorder nudge (e.g. "Time to re-order tyres?") */
  RESTOCK: 'bg_reorder_v1',
  /** New product arrival announcement */
  NEW_ARRIVAL: 'bg_new_arrival_v1',
  /** Generic promotional / campaign message */
  PROMO: 'bg_promo_v1',
} as const;

export type TemplateKey = keyof typeof WA_TEMPLATES;
export type TemplateName = (typeof WA_TEMPLATES)[TemplateKey];

/**
 * Variable mapping documentation for each template.
 * This is the contract between BharatGrowth and Meta template definitions.
 *
 * bg_receipt_v1:
 *   {{1}} = customer_name
 *   {{2}} = shop_name
 *   {{3}} = formatted_amount (e.g. "₹1,500")
 *   {{4}} = receipt_url
 *
 * bg_khata_v1:
 *   {{1}} = customer_name
 *   {{2}} = shop_name
 *   {{3}} = formatted_balance (e.g. "₹5,000")
 *   {{4}} = upi_line (UPI instruction or empty)
 *
 * bg_reorder_v1:
 *   {{1}} = customer_name
 *   {{2}} = shop_name
 *   {{3}} = product_or_category (e.g. "MRF ZLX 185/65 R15" or "Kaju Katli")
 *
 * bg_new_arrival_v1:
 *   {{1}} = customer_name
 *   {{2}} = shop_name
 *   {{3}} = item_description (e.g. "New winter collection", "Fresh Diwali sweets")
 *
 * bg_promo_v1:
 *   {{1}} = customer_name
 *   {{2}} = shop_name
 *   {{3}} = promo_message (custom text from campaign rule)
 */

/** Human-readable labels for simulation logging */
export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  [WA_TEMPLATES.RECEIPT]: 'Purchase Receipt',
  [WA_TEMPLATES.KHATA]: 'Khata Reminder',
  [WA_TEMPLATES.RESTOCK]: 'Restock Nudge',
  [WA_TEMPLATES.NEW_ARRIVAL]: 'New Arrival',
  [WA_TEMPLATES.PROMO]: 'Promotional Campaign',
};
