import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StorefrontPage, { generateMetadata } from '../page';

vi.mock('../StorefrontLoader', () => ({
  StorefrontLoader: ({ shopId }: { shopId: string }) => (
    <div>Storefront loader for {shopId}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('Storefront route behavior contract before decomposition', () => {
  it('preserves generated metadata and passes a valid UUID to the client loader', async () => {
    const shopId = '11111111-1111-4111-8111-111111111111';

    await expect(generateMetadata({ params: Promise.resolve({ shop_id: shopId }) })).resolves.toEqual({
      title: 'Store | BharatGrowth',
      description: 'Browse products and order on WhatsApp',
      openGraph: {
        title: 'BharatGrowth Store',
        description: 'Browse products and order on WhatsApp',
      },
      other: { shop_id: shopId },
    });

    render(await StorefrontPage({ params: Promise.resolve({ shop_id: shopId }) }));
    expect(screen.getByText(`Storefront loader for ${shopId}`)).toBeInTheDocument();
  });

  it('rejects a non-UUID route before rendering the loader', async () => {
    render(await StorefrontPage({ params: Promise.resolve({ shop_id: 'not-a-shop' }) }));

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.getByText('Store not found.')).toBeInTheDocument();
    expect(screen.queryByText(/Storefront loader for/)).not.toBeInTheDocument();
  });
});
