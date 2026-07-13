'use client';

import { useCallback, useEffect, useState } from 'react';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';
import {
  fetchAllDashboardData,
  type DashboardData,
} from './dashboardQueries';
import {
  buildDashboardDateRange,
  type DatePreset,
} from './dashboardPresentation';

export function useDashboardData() {
  const [shopId, setShopId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('My Shop');
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const buildDateRange = useCallback(
    () => buildDashboardDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((context) => {
        if (context) setShopId(context.shopId);
      });
    });
  }, []);

  useEffect(() => {
    if (!shopId) return;

    async function loadShop() {
      const supabase = createClient();
      const { data: shop } = await supabase
        .from('shops')
        .select('business_name')
        .eq('id', shopId)
        .single();

      if (shop) setShopName(shop.business_name);
    }

    loadShop();
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;

    async function load() {
      setLoading(true);
      const range = buildDateRange();
      const dashboardData = await fetchAllDashboardData(shopId, range);
      setData(dashboardData);
      setLoading(false);
    }

    load();
  }, [shopId, datePreset, customStart, customEnd, buildDateRange]);

  return {
    customEnd,
    customStart,
    data,
    datePreset,
    loading,
    setCustomEnd,
    setCustomStart,
    setData,
    setDatePreset,
    shopId,
    shopName,
  };
}

export type DashboardDataController = ReturnType<typeof useDashboardData>;
