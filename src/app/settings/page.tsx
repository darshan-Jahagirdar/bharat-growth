'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkUserOnboarded } from '@/lib/auth/checkUserOnboarded';
import TopNav from '@/components/layout/TopNav';
import TaxSettings from './TaxSettings';

export default function SettingsPage() {
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      checkUserOnboarded(session.user.id).then((ctx) => {
        if (ctx) {
          setShopId(ctx.shopId);
          setShopName(ctx.shopName);
        }
        setLoading(false);
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <TopNav />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!shopId) {
    return (
      <div className="min-h-screen bg-slate-950">
        <TopNav />
        <div className="flex items-center justify-center h-[60vh] text-gray-500 text-sm">
          Shop not found. Complete onboarding first.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <TopNav />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-white mb-1">Settings</h1>
        <p className="text-xs text-gray-500 mb-8">{shopName}</p>

        <section className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Tax & GST</h2>
          <TaxSettings shopId={shopId} />
        </section>
      </main>
    </div>
  );
}
