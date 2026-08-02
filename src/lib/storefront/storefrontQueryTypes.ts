import type {
  BusinessType,
  GstRatePercent,
  ProductUnit,
  ThemePreference,
  VerticalAttrs,
} from '@/lib/types/database';

export interface StorefrontShop {
  id: string;
  business_name: string;
  business_type: BusinessType;
  city: string | null;
  state_code: string;
  logo_url: string | null;
  theme_preference: ThemePreference;
  primary_color: string;
  owner_phone: string | null;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  sku: string | null;
  hsn_code: string;
  selling_price_paise: number;
  gst_rate_percent: GstRatePercent;
  unit: ProductUnit;
  category: string | null;
  image_url: string | null;
  vertical_attrs: VerticalAttrs;
  is_stock_tracked: boolean;
  stock_quantity: number | null;
}
