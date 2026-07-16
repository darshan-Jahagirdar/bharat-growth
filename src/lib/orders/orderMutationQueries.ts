import { createClient } from '@/lib/supabase/client';
import type {
  ConvertResult,
  CreatePOParams,
  CreateSOParams,
} from './orderQueryTypes';

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

export async function cancelSalesOrder(
  soId: string,
  shopId: string
): Promise<ConvertResult> {
  const supabase = createClient();

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

export async function cancelPurchaseOrder(
  poId: string,
  shopId: string
): Promise<ConvertResult> {
  const supabase = createClient();

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
