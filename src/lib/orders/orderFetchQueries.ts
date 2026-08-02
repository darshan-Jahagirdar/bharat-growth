import { createClient } from '@/lib/supabase/client';
import { PAGE_SIZE } from './orderQueryConstants';
import type {
  FetchResult,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  SalesOrderItemRow,
  SalesOrderRow,
} from './orderQueryTypes';

export async function fetchPurchaseOrders(
  shopId: string,
  offset: number = 0
): Promise<FetchResult<PurchaseOrderRow>> {
  const supabase = createClient();

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

  const poIds = headers.map((h) => h.id);
  const { data: rawItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('id, po_id, product_id, quantity, expected_price_paise, products:product_id(name, unit)')
    .in('po_id', poIds);

  if (itemsError) {
    console.error('[Orders] PO items fetch error:', itemsError.message);
  }

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

  const rows = headers.map((h) => ({
    ...h,
    items: itemsByPo[h.id] ?? [],
  }));

  return { rows, hasMore };
}

export async function fetchSalesOrders(
  shopId: string,
  offset: number = 0
): Promise<FetchResult<SalesOrderRow>> {
  const supabase = createClient();

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

  const soIds = headers.map((h) => h.id);
  const { data: rawItems, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('id, so_id, product_id, quantity, agreed_price_paise, products:product_id(name, unit)')
    .in('so_id', soIds);

  if (itemsError) {
    console.error('[Orders] SO items fetch error:', itemsError.message);
  }

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
