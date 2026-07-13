'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchAllDashboardData,
  type DashboardData,
  type NegativeStockProduct,
} from './dashboardQueries';

interface UseStockReconciliationOptions {
  setData: Dispatch<SetStateAction<DashboardData | null>>;
  shopId: string;
}

export function useStockReconciliation({
  setData,
  shopId,
}: UseStockReconciliationOptions) {
  const [target, setTarget] = useState<NegativeStockProduct | null>(null);
  const [quantity, setQuantity] = useState('');
  const [resolving, setResolving] = useState(false);

  function openTarget(nextTarget: NegativeStockProduct) {
    setTarget(nextTarget);
    setQuantity('');
  }

  async function resolve() {
    if (!target) return;
    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) return;

    setResolving(true);
    const supabase = createClient();
    await supabase.rpc('adjust_stock', {
      p_shop_id: shopId,
      p_product_id: target.product_id,
      p_quantity_change: parsedQuantity,
      p_movement_type: 'purchase',
      p_notes: `Reconciliation: logged missing delivery of ${parsedQuantity} ${target.unit}`,
      p_reference_id: null,
      p_reference_type: 'manual',
      p_allow_negative: true,
    });
    setResolving(false);
    setTarget(null);

    const dashboardData = await fetchAllDashboardData(shopId);
    setData(dashboardData);
  }

  return {
    openTarget,
    quantity,
    resolve,
    resolving,
    setQuantity,
    setTarget,
    target,
  };
}

export type StockReconciliationController = ReturnType<
  typeof useStockReconciliation
>;
