// =============================================================================
// BharatGrowth — Order Engine Queries (Phase 29.3 → 29.7)
// Data layer for Purchase Orders and Sales Orders
// All queries filter by shop_id for RLS compliance
//
// Phase 29.7: Paginated fetches (PAGE_SIZE=50), cancel status guards,
//             FetchResult<T> return type for cursor-based "Load More"
// =============================================================================

import { createClient } from '@/lib/supabase/client';
import type {
  ConvertResult,
  CreatePOParams,
  CreateSOParams,
  FetchResult,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  SalesOrderItemRow,
  SalesOrderRow,
} from './orderQueryTypes';

export type {
  ConvertResult,
  CreatePOParams,
  CreateSOParams,
  FetchResult,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  SalesOrderItemRow,
  SalesOrderRow,
} from './orderQueryTypes';

// ── Pagination ──

export const PAGE_SIZE = 50;

// ── Fetch Purchase Orders (paginated) ──

export async function fetchPurchaseOrders(
  shopId: string,
  offset: number = 0
): Promise<FetchResult<PurchaseOrderRow>> {
  const supabase = createClient();

  // 1. Fetch PO headers (paginated)
  const { data: poHeaders, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, po_sequence, financial_year, supplier_name, status, expected_date, total_amount_paise, notes, created_at, updated_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (poError) {
    console.error('[Orders] PO fetch error:', poError.message);
    return { rows: [], hasMore: false };
  }

  const headers = poHeaders ?? [];
  if (headers.length === 0) return { rows: [], hasMore: false };

  const hasMore = headers.length === PAGE_SIZE;

  // 2. Batch-fetch all items for this page of POs with product name join
  const poIds = headers.map((h) => h.id);
  const { data: rawItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('id, po_id, product_id, quantity, expected_price_paise, products:product_id(name, unit)')
    .in('po_id', poIds);

  if (itemsError) {
    console.error('[Orders] PO items fetch error:', itemsError.message);
  }

  // 3. Group items by po_id
  const itemsByPo: Record<string, PurchaseOrderItemRow[]> = {};
  for (const raw of rawItems ?? []) {
    const poId = (raw as unknown as { po_id: string }).po_id;
    const product = raw.products as unknown as { name: string; unit: string } | null;
    const item: PurchaseOrderItemRow = {
      id: raw.id,
      product_id: raw.product_id,
      quantity: raw.quantity,
      expected_price_paise: raw.expected_price_paise,
      product_name: product?.name ?? null,
      product_unit: product?.unit ?? null,
    };
    if (!itemsByPo[poId]) itemsByPo[poId] = [];
    itemsByPo[poId].push(item);
  }

  // 4. Merge headers + items
  const rows = headers.map((h) => ({
    ...h,
    items: itemsByPo[h.id] ?? [],
  }));

  return { rows, hasMore };
}

// ── Fetch Sales Orders (paginated) ──

export async function fetchSalesOrders(
  shopId: string,
  offset: number = 0
): Promise<FetchResult<SalesOrderRow>> {
  const supabase = createClient();

  // 1. Fetch SO headers with customer name join (paginated)
  const { data: soHeaders, error: soError } = await supabase
    .from('sales_orders')
    .select('id, so_number, so_sequence, financial_year, customer_id, status, valid_until, total_amount_paise, notes, created_at, updated_at, customers:customer_id(name, phone_number)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (soError) {
    console.error('[Orders] SO fetch error:', soError.message);
    return { rows: [], hasMore: false };
  }

  const headers = soHeaders ?? [];
  if (headers.length === 0) return { rows: [], hasMore: false };

  const hasMore = headers.length === PAGE_SIZE;

  // 2. Batch-fetch all items for this page of SOs with product name join
  const soIds = headers.map((h) => h.id);
  const { data: rawItems, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('id, so_id, product_id, quantity, agreed_price_paise, products:product_id(name, unit)')
    .in('so_id', soIds);

  if (itemsError) {
    console.error('[Orders] SO items fetch error:', itemsError.message);
  }

  // 3. Group items by so_id
  const itemsBySo: Record<string, SalesOrderItemRow[]> = {};
  for (const raw of rawItems ?? []) {
    const soId = (raw as unknown as { so_id: string }).so_id;
    const product = raw.products as unknown as { name: string; unit: string } | null;
    const item: SalesOrderItemRow = {
      id: raw.id,
      product_id: raw.product_id,
      quantity: raw.quantity,
      agreed_price_paise: raw.agreed_price_paise,
      product_name: product?.name ?? null,
      product_unit: product?.unit ?? null,
    };
    if (!itemsBySo[soId]) itemsBySo[soId] = [];
    itemsBySo[soId].push(item);
  }

  // 4. Merge headers + items (flatten customer join)
  const rows = headers.map((h) => {
    const customer = h.customers as unknown as { name: string | null; phone_number: string | null } | null;
    return {
      id: h.id,
      so_number: h.so_number,
      so_sequence: h.so_sequence,
      financial_year: h.financial_year,
      customer_id: h.customer_id,
      customer_name: customer?.name ?? null,
      customer_phone: customer?.phone_number ?? null,
      status: h.status,
      valid_until: h.valid_until,
      total_amount_paise: h.total_amount_paise,
      notes: h.notes,
      created_at: h.created_at,
      updated_at: h.updated_at,
      items: itemsBySo[h.id] ?? [],
    };
  });

  return { rows, hasMore };
}

// ── Convert Purchase Order to Bill ──

export async function convertPurchaseOrder(
  poId: string,
  billNumber?: string
): Promise<ConvertResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('convert_po_to_bill', {
    p_po_id: poId,
    ...(billNumber ? { p_bill_number: billNumber } : {}),
  });

  if (error) {
    console.error('[Orders] convert_po_to_bill error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  return {
    success: true,
    data: data as Record<string, unknown>,
    error: null,
  };
}

// ── Create Sales Order (from POS cart) ──

export async function saveSalesOrder(
  params: CreateSOParams
): Promise<ConvertResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('create_sales_order', {
    p_order: {
      shop_id: params.shopId,
      customer_id: params.customerId,
      total_amount_paise: params.totalAmountPaise,
      notes: params.notes ?? null,
      created_by: params.createdBy ?? null,
    },
    p_items: params.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      agreed_price_paise: item.agreedPricePaise,
    })),
  });

  if (error) {
    console.error('[Orders] create_sales_order error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  return {
    success: true,
    data: data as Record<string, unknown>,
    error: null,
  };
}

// ── Create Purchase Order (from Speed Grid) ──

export async function savePurchaseOrder(
  params: CreatePOParams
): Promise<ConvertResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_order: {
      shop_id: params.shopId,
      supplier_name: params.supplierName,
      expected_date: params.expectedDate ?? null,
      total_amount_paise: params.totalAmountPaise,
      notes: params.notes ?? null,
      created_by: params.createdBy ?? null,
    },
    p_items: params.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      expected_price_paise: item.expectedPricePaise,
    })),
  });

  if (error) {
    console.error('[Orders] create_purchase_order error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  return {
    success: true,
    data: data as Record<string, unknown>,
    error: null,
  };
}

// ── Cancel Sales Order (with backend status guard) ──

export async function cancelSalesOrder(
  soId: string,
  shopId: string
): Promise<ConvertResult> {
  const supabase = createClient();

  // FIX #3: .in('status', [...]) prevents cancelling fulfilled orders.
  // .select('id') returns updated rows — empty array means no rows matched.
  const { data, error } = await supabase
    .from('sales_orders')
    .update({ status: 'cancelled' })
    .eq('id', soId)
    .eq('shop_id', shopId)
    .in('status', ['draft', 'reserved'])
    .select('id');

  if (error) {
    console.error('[Orders] cancelSalesOrder error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      data: null,
      error: 'Order cannot be cancelled (already fulfilled or cancelled)',
    };
  }

  return { success: true, data: null, error: null };
}

// ── Cancel Purchase Order (with backend status guard) ──

export async function cancelPurchaseOrder(
  poId: string,
  shopId: string
): Promise<ConvertResult> {
  const supabase = createClient();

  // FIX #3: .in('status', [...]) prevents cancelling fulfilled orders.
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', poId)
    .eq('shop_id', shopId)
    .in('status', ['draft', 'sent'])
    .select('id');

  if (error) {
    console.error('[Orders] cancelPurchaseOrder error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      data: null,
      error: 'Order cannot be cancelled (already fulfilled or cancelled)',
    };
  }

  return { success: true, data: null, error: null };
}

// ── Convert Sales Order to Invoice ──

export async function convertSalesOrder(
  soId: string,
  paymentMode: string
): Promise<ConvertResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('convert_so_to_invoice', {
    p_so_id: soId,
    p_payment_mode: paymentMode,
  });

  if (error) {
    console.error('[Orders] convert_so_to_invoice error:', error.message);
    return { success: false, data: null, error: error.message };
  }

  return {
    success: true,
    data: data as Record<string, unknown>,
    error: null,
  };
}
