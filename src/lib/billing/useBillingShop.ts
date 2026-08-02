import { useEffect, useState } from 'react';
import { checkUserOnboarded, type UserShopContext } from '@/lib/auth/checkUserOnboarded';
import { createClient } from '@/lib/supabase/client';

export function useBillingShopContext(supabaseConfigured: boolean) {
  const [shopContext, setShopContext] = useState<UserShopContext | null>(null);
  const [shopUpiId, setShopUpiId] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');

  const shopId = shopContext?.shopId ?? '';
  const gstType = (shopContext?.gstType ?? 'regular') as 'regular' | 'composition';
  const shopStateCode = shopContext?.stateCode ?? '27';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((context) => {
        if (context) setShopContext(context);
      });
    });
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !shopId) return;
    import('@/lib/billing/billingQueries').then(({ fetchShopContext }) => {
      fetchShopContext(shopId).then((shop) => {
        if (shop) {
          setShopUpiId(shop.upi_id ?? null);
          setShopName(shop.business_name);
        }
      });
    });
  }, [shopId, supabaseConfigured]);

  return {
    shopContext,
    shopId,
    gstType,
    shopStateCode,
    shopUpiId,
    shopName,
  };
}

export function usePendingOnlineOrders(shopId: string, supabaseConfigured: boolean) {
  const [pendingOnlineCount, setPendingOnlineCount] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured || !shopId) return;
    const supabase = createClient();
    const fetchCount = () => {
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'pending_online')
        .then(({ count, error }) => {
          if (error) {
            console.error('[PendingOrders] Poll failed:', error.message);
          } else {
            setPendingOnlineCount(count ?? 0);
          }
        });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15_000);

    const channel = supabase
      .channel('pending-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices', filter: `shop_id=eq.${shopId}` },
        (payload) => {
          if (payload.new && (payload.new as Record<string, unknown>).status === 'pending_online') {
            console.log('[PendingOrders] Realtime: new online order!');
            fetchCount();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [shopId, supabaseConfigured]);

  return { pendingOnlineCount, setPendingOnlineCount };
}
