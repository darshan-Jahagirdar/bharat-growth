'use client';

// =============================================================================
// BharatGrowth — Storefront Client Loader
// Fetches shop + products via browser Supabase client (bypasses Node.js
// server-side fetch timeout issues on local dev)
// =============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StorefrontShop, StorefrontProduct } from '@/lib/storefront/queries';
import type { BusinessType, ThemePreference } from '@/lib/types/database';

import { IndustrialTheme } from '@/components/storefront/IndustrialTheme';
import { FestiveTheme } from '@/components/storefront/FestiveTheme';
import { ModernTheme } from '@/components/storefront/ModernTheme';

interface StorefrontLoaderProps {
  shopId: string;
}

type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

export function StorefrontLoader({ shopId }: StorefrontLoaderProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [shop, setShop] = useState<StorefrontShop | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchStorefront() {
      const supabase = createClient();

      // ── Fetch shop ──
      const { data: shopData, error: shopErr } = await supabase
        .from('shops')
        .select(
          'id, business_name, business_type, city, state_code, logo_url, theme_preference, primary_color'
        )
        .eq('id', shopId)
        .single();

      if (cancelled) return;

      if (shopErr || !shopData) {
        console.error('[StorefrontLoader] Shop query error:', shopErr?.message);
        setLoadState(shopErr?.code === 'PGRST116' ? 'not_found' : 'error');
        setErrorMsg(shopErr?.message ?? 'Shop not found');
        return;
      }

      // ── Fetch owner phone (separate, non-blocking) ──
      const { data: ownerData } = await supabase
        .from('users')
        .select('phone')
        .eq('shop_id', shopId)
        .eq('role', 'owner')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const shopProfile: StorefrontShop = {
        id: shopData.id,
        business_name: shopData.business_name,
        business_type: shopData.business_type as BusinessType,
        city: shopData.city ?? null,
        state_code: shopData.state_code,
        logo_url: shopData.logo_url ?? null,
        theme_preference: (shopData.theme_preference ?? 'modern') as ThemePreference,
        primary_color: shopData.primary_color ?? '#2563EB',
        owner_phone: ownerData?.phone ?? null,
      };

      // ── Fetch products (include inventory for stock clamping) ──
      const { data: productsData, error: productsErr } = await supabase
        .from('products')
        .select(
          'id, name, sku, hsn_code, selling_price_paise, gst_rate_percent, unit, category, image_url, vertical_attrs, is_stock_tracked, inventory(quantity_in_stock)'
        )
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('category', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (cancelled) return;

      if (productsErr) {
        console.warn('[StorefrontLoader] Products query error:', productsErr.message);
      }

      // Map raw data to StorefrontProduct with stock info
      const mappedProducts: StorefrontProduct[] = (productsData ?? []).map((p: Record<string, unknown>) => {
        const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
        return {
          id: p.id as string,
          name: p.name as string,
          sku: (p.sku as string) ?? null,
          hsn_code: p.hsn_code as string,
          selling_price_paise: p.selling_price_paise as number,
          gst_rate_percent: p.gst_rate_percent as StorefrontProduct['gst_rate_percent'],
          unit: p.unit as StorefrontProduct['unit'],
          category: (p.category as string) ?? null,
          image_url: (p.image_url as string) ?? null,
          vertical_attrs: (p.vertical_attrs ?? {}) as StorefrontProduct['vertical_attrs'],
          is_stock_tracked: (p.is_stock_tracked as boolean) ?? false,
          // Tracked products with no inventory row are 0 stock (matches the
          // server, which treats a missing row as 0 and rejects checkout).
          // null is reserved for untracked products (unlimited availability).
          stock_quantity: (p.is_stock_tracked as boolean)
            ? (inv ? Number((inv as { quantity_in_stock: number }).quantity_in_stock) : 0)
            : null,
        };
      });

      // Update document title with shop name
      document.title = `${shopProfile.business_name} | BharatGrowth`;

      setShop(shopProfile);
      setProducts(mappedProducts);
      setLoadState('loaded');
    }

    fetchStorefront();

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  // ── Loading state ──
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading storefront...</p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (loadState === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
          <p className="text-gray-500">This store does not exist.</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (loadState === 'error' || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Route to correct theme ──
  switch (shop.theme_preference) {
    case 'industrial':
      return <IndustrialTheme shop={shop} products={products} />;
    case 'festive':
      return <FestiveTheme shop={shop} products={products} />;
    case 'modern':
    default:
      return <ModernTheme shop={shop} products={products} />;
  }
}
