// =============================================================================
// BharatGrowth — Billing Page Supabase Query Compatibility Facade
// =============================================================================

export {
  fetchCustomerLoyalty,
  lookupBarcode,
  searchCustomers,
  searchProducts,
} from './billingSearchQueries';
export {
  processCreditRepayment,
  saveInvoice,
} from './billingInvoiceQueries';
export {
  createNewCustomer,
  refreshCustomer,
  uploadCustomerImage,
} from './billingCustomerQueries';
export { fetchShopContext } from './billingShopQueries';
export type { SaveInvoiceParams, SaveInvoiceResult } from './billingQueryTypes';
