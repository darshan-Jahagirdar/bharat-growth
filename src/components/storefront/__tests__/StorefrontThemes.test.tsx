import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontProduct, StorefrontShop } from '@/lib/storefront/queries';
import { FestiveTheme } from '../FestiveTheme';
import { IndustrialTheme } from '../IndustrialTheme';

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const SHOP: StorefrontShop = {
  id: '11111111-1111-4111-8111-111111111111',
  business_name: 'Ganesh Tyres',
  business_type: 'tyre_shop',
  city: 'Pune',
  state_code: '27',
  logo_url: null,
  theme_preference: 'industrial',
  primary_color: '#F97316',
  owner_phone: '+91 98765-43210',
};

function product(overrides: Partial<StorefrontProduct>): StorefrontProduct {
  return {
    id: 'product-1',
    name: 'Road King',
    sku: 'RK-1',
    hsn_code: '4011',
    selling_price_paise: 123_456,
    gst_rate_percent: 18,
    unit: 'piece',
    category: 'Tyres',
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: false,
    stock_quantity: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('Industrial and Festive theme behavior contract before decomposition', () => {
  it('preserves Industrial grouping, fallback, product output, WhatsApp CTA, and footer', () => {
    render(
      <IndustrialTheme
        shop={SHOP}
        products={[
          product({ id: 'tyre', name: 'Road King', category: 'Tyres' }),
          product({ id: 'other', name: 'Wheel Service', category: null, unit: 'service' }),
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Ganesh Tyres' })).toBeInTheDocument();
    expect(screen.getByText('Pune')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our Products (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tyres' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getAllByText('₹1,235')).toHaveLength(2);
    expect(screen.getByText('/service')).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: 'Buy on WhatsApp' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      'href',
      `https://wa.me/919876543210?text=${encodeURIComponent(
        'Hi, I would like to order: Road King priced at ₹1,234.56'
      )}`
    );
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Powered by BharatGrowth')).toBeInTheDocument();
  });

  it('preserves Festive grouping, emoji selection, fallback, price/unit copy, and WhatsApp CTA', () => {
    render(
      <FestiveTheme
        shop={{ ...SHOP, business_name: 'Mithai Mahal', theme_preference: 'festive' }}
        products={[
          product({ id: 'sweet', name: 'Kaju Katli', category: 'Sweets', unit: 'kg' }),
          product({ id: 'special', name: 'Gift Box', category: null }),
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Mithai Mahal' })).toBeInTheDocument();
    expect(screen.getByText('Browse our catalog and order via WhatsApp')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sweets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Specialities' })).toBeInTheDocument();
    expect(screen.getByText('🍬')).toBeInTheDocument();
    expect(screen.getByText('✨')).toBeInTheDocument();
    expect(screen.getByText('per kg')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,235')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Buy on WhatsApp' })).toHaveLength(2);
  });

  it('preserves owner-contact conditionals and theme-specific empty states', () => {
    const industrial = render(<IndustrialTheme shop={{ ...SHOP, owner_phone: null }} products={[]} />);
    expect(screen.getByText('No products listed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buy on WhatsApp' })).not.toBeInTheDocument();
    industrial.unmount();

    render(
      <FestiveTheme
        shop={{ ...SHOP, owner_phone: null, theme_preference: 'festive' }}
        products={[]}
      />
    );
    expect(screen.getByText('Menu coming soon!')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buy on WhatsApp' })).not.toBeInTheDocument();
  });
});
