'use client';

import { useEffect, useState } from 'react';
import { checkUserOnboarded, type UserShopContext } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';

export function usePurchaseBillContext() {
  const [shopContext, setShopContext] = useState<UserShopContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scansRemaining, setScansRemaining] = useState<number | null>(null);
  const shopId = shopContext?.shopId ?? '';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setAuthLoading(false);
        return;
      }
      checkUserOnboarded(session.user.id).then((context) => {
        setShopContext(context);
        setAuthLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createClient();
    supabase
      .from('shops')
      .select('monthly_ai_scans')
      .eq('id', shopId)
      .single()
      .then(({ data }) => {
        if (data) setScansRemaining(data.monthly_ai_scans ?? 0);
      });
  }, [shopId]);

  return {
    authLoading,
    scansRemaining,
    setScansRemaining,
    shopContext,
    shopId,
  };
}

export type PurchaseBillContextController = ReturnType<typeof usePurchaseBillContext>;
