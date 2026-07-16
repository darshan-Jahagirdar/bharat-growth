import { getDashboardClient } from './dashboardClient';
import type {
  CreditCustomer,
  LowStockProduct,
  NegativeStockProduct,
} from './dashboardQueryTypes';

export async function fetchKhataCustomers(
  shopId: string,
  limit = 50
): Promise<CreditCustomer[]> {
  const client = getDashboardClient();

  const { data, error } = await client
    .from('customers')
    .select('id, name, phone_number, photo_url, credit_balance_paise, last_visit_at')
    .eq('shop_id', shopId)
    .gt('credit_balance_paise', 0)
    .order('credit_balance_paise', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Dashboard] Khata query error:', error.message);
    return [];
  }

  return (data ?? []) as CreditCustomer[];
}

export async function fetchLowStockProducts(
  shopId: string,
  threshold = 10,
  limit = 50
): Promise<LowStockProduct[]> {
  const client = getDashboardClient();

  const { data, error } = await client
    .from('inventory')
    .select('id, quantity_in_stock, reorder_level, products!inner(id, name, unit, is_active)')
    .eq('shop_id', shopId)
    .lt('quantity_in_stock', threshold)
    .order('quantity_in_stock', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Dashboard] Low stock query error:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const product = row.products as unknown as { is_active: boolean };
      return product?.is_active !== false;
    })
    .map((row) => {
      const product = row.products as unknown as {
        id: string;
        name: string;
        unit: string;
      };
      return {
        id: product.id,
        name: product.name,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: product.unit,
        reorder_level: row.reorder_level ? Number(row.reorder_level) : null,
      };
    });
}

export async function fetchNegativeStockProducts(
  shopId: string
): Promise<NegativeStockProduct[]> {
  const client = getDashboardClient();

  const { data, error } = await client
    .from('inventory')
    .select('id, product_id, quantity_in_stock, products!inner(name, unit, is_stock_tracked)')
    .eq('shop_id', shopId)
    .lt('quantity_in_stock', 0)
    .order('quantity_in_stock', { ascending: true });

  if (error) {
    console.error('[Dashboard] Negative stock query error:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const product = row.products as unknown as { is_stock_tracked: boolean };
      return product?.is_stock_tracked === true;
    })
    .map((row) => {
      const product = row.products as unknown as { name: string; unit: string };
      return {
        product_id: row.product_id,
        inventory_id: row.id,
        name: product.name,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: product.unit,
      };
    });
}
