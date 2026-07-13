'use client';

import { useCallback, useEffect, useState } from 'react';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types/database';
import type { CampaignTag } from './productForm';

export function useProductsData() {
  const [shopId, setShopId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<CampaignTag[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((context) => {
        if (context) setShopId(context.shopId);
      });
    });
  }, [supabase]);

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');

    if (fetchError) {
      setError(`Failed to load products: ${fetchError.message}`);
    } else {
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
  }, [supabase, shopId]);

  const fetchStock = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('inventory')
      .select('product_id, quantity_in_stock')
      .eq('shop_id', shopId);

    if (data) {
      const nextStock = new Map<string, number>();
      for (const row of data) {
        nextStock.set(row.product_id, Number(row.quantity_in_stock));
      }
      setStockMap(nextStock);
    }
  }, [supabase, shopId]);

  const fetchTags = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('tags')
      .select('id, name')
      .eq('shop_id', shopId)
      .order('name');
    setTags((data ?? []) as CampaignTag[]);
  }, [supabase, shopId]);

  useEffect(() => {
    fetchProducts();
    fetchStock();
    fetchTags();
  }, [fetchProducts, fetchStock, fetchTags]);

  return {
    error,
    fetchProducts,
    fetchStock,
    loading,
    products,
    setError,
    setTags,
    shopId,
    stockMap,
    supabase,
    tags,
  };
}

export type ProductsDataController = ReturnType<typeof useProductsData>;
