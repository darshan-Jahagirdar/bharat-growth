import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontProduct, StorefrontShop } from '@/lib/storefront/queries';
import { ModernTheme } from '../ModernTheme';

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
  theme_preference: 'modern',
  primary_color: '#2563EB',
  owner_phone: '+91 98765-43210',
};

function product(overrides: Partial<StorefrontProduct>): StorefrontProduct {
  return {
    id: 'product-a',
    name: 'A',
    sku: null,
    hsn_code: '4011',
    selling_price_paise: 5_000,
    gst_rate_percent: 18,
    unit: 'piece',
    category: 'Tyres',
    image_url: null,
    vertical_attrs: {},
    is_stock_tracked: true,
    stock_quantity: 2,
    ...overrides,
  };
}

const PRODUCTS = [
  product({ id: 'product-a', name: 'A', category: 'Tyres', stock_quantity: 2 }),
  product({
    id: 'product-sweet',
    name: 'Sweet Box',
    category: 'Sweets',
    selling_price_paise: 12_345,
    unit: 'box',
    is_stock_tracked: false,
    stock_quantity: null,
  }),
  product({
    id: 'product-zero',
    name: 'Zero Stock',
    category: 'Tyres',
    stock_quantity: 0,
  }),
];

function productCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('.bg-white');
  if (!card) throw new Error(`Card not found for ${name}`);
  return card as HTMLElement;
}

function addProduct(name: string) {
  fireEvent.click(within(productCard(name)).getByRole('button', { name: 'ADD' }));
}

function openCheckout() {
  fireEvent.click(screen.getByRole('button', { name: /Checkout/ }));
  return screen.getByRole('heading', { name: 'Your Order' }).closest('.absolute.bottom-0') as HTMLElement;
}

function fillRequiredCheckout({ marketing = false }: { marketing?: boolean } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Your Name *'), {
    target: { value: '  Buyer  ' },
  });
  fireEvent.change(screen.getByPlaceholderText('Phone Number *'), {
    target: { value: '9876543210' },
  });
  fireEvent.change(screen.getByPlaceholderText('Delivery Address (optional)'), {
    target: { value: '  MG Road  ' },
  });
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
  if (marketing) fireEvent.click(checkboxes[1]);
}

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Modern storefront behavior contract before decomposition', () => {
  it('preserves header, sorted categories, combined search, clear, placeholder, price/unit, and empty output', () => {
    const view = render(<ModernTheme shop={SHOP} products={PRODUCTS} />);

    expect(screen.getByRole('heading', { name: 'Ganesh Tyres' })).toBeInTheDocument();
    expect(screen.getByText('Pune')).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((button) => ['All', 'Sweets', 'Tyres'].includes(button.textContent ?? '')).map((button) => button.textContent)).toEqual([
      'All',
      'Sweets',
      'Tyres',
    ]);
    expect(screen.getByText('₹123')).toBeInTheDocument();
    expect(screen.getByText('per box')).toBeInTheDocument();
    const initial = within(productCard('A')).getByText('A', { selector: 'span' });
    expect(initial.parentElement).toHaveStyle({ backgroundColor: '#F59E0B12' });

    const search = screen.getByPlaceholderText('Search in Ganesh Tyres...');
    fireEvent.change(search, { target: { value: 'sweets' } });
    expect(screen.getByRole('heading', { name: 'Sweet Box' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tyres' }));
    expect(screen.getByText('No products found')).toBeInTheDocument();

    const clearButton = search.parentElement?.querySelector('button');
    if (!clearButton) throw new Error('Search clear button not found');
    fireEvent.click(clearButton);
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zero Stock' })).toBeInTheDocument();
    expect(view.container.querySelector('.scrollbar-hide')).toHaveClass('overflow-x-auto', 'scrollbar-hide');
  });

  it('preserves zero-stock blocking, untracked availability, cart math, stock clamp toast, and decrement/removal', () => {
    vi.useFakeTimers();
    render(<ModernTheme shop={SHOP} products={PRODUCTS} />);

    expect(within(productCard('Zero Stock')).getByRole('button', { name: 'ADD' })).toBeDisabled();
    expect(within(productCard('Sweet Box')).getByRole('button', { name: 'ADD' })).toBeEnabled();

    addProduct('A');
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Checkout/ })).getByText('₹50')).toBeInTheDocument();
    fireEvent.click(within(productCard('A')).getByRole('button', { name: '+' }));
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('₹100')).toBeInTheDocument();
    expect(within(productCard('A')).getByRole('button', { name: '+' })).toBeDisabled();

    const drawer = openCheckout();
    fireEvent.click(within(drawer).getByRole('button', { name: '+' }));
    expect(screen.getByText('Only 2 available in stock')).toBeInTheDocument();
    expect(within(drawer).getByText('2')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: '-' }));
    expect(screen.getByText('1 item')).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole('button', { name: '-' }));
    expect(screen.getByRole('heading', { name: 'Your Order' })).toBeInTheDocument();
    expect(within(drawer).getByText('₹0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Checkout/ })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(screen.queryByText('Only 2 available in stock')).not.toBeInTheDocument();
  });

  it('preserves drawer scroll lock, backdrop close, required fields, consent distinction, payment modes, and missing contact', async () => {
    const first = render(<ModernTheme shop={SHOP} products={[PRODUCTS[0]]} />);
    addProduct('A');
    const drawer = openCheckout();

    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
    expect(screen.getByPlaceholderText('Phone Number *')).toHaveAttribute('maxlength', '10');
    const submit = screen.getByRole('button', { name: 'Place Order on WhatsApp' });
    expect(submit).toBeDisabled();
    fillRequiredCheckout();
    expect(submit).toBeEnabled();
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '📒 Add to Khata' }));
    expect(screen.getByRole('button', { name: '📒 Add to Khata' })).toHaveClass('border-orange-500');

    const backdrop = drawer.previousElementSibling;
    if (!backdrop) throw new Error('Checkout backdrop not found');
    fireEvent.click(backdrop);
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
    first.unmount();

    render(<ModernTheme shop={{ ...SHOP, owner_phone: null }} products={[PRODUCTS[0]]} />);
    addProduct('A');
    openCheckout();
    expect(screen.getByText('Shop contact not available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Place Order on WhatsApp' })).not.toBeInTheDocument();
  });

  it('reuses an idempotency key after non-2xx, hard-stops WhatsApp, then clears and retires it after success', async () => {
    const firstKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const nextKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(firstKey)
      .mockReturnValueOnce(nextKey);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({ error: 'Stock changed' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          order_id: 'order-1',
          invoice_number: 'ON/2026-27/00009',
          total_paise: 6_000,
        }),
      })
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const originalWindow = globalThis.window;
    const fakeLocation = { href: 'http://localhost:3000/' };
    vi.stubGlobal('window', new Proxy(originalWindow, {
      get(target, property, receiver) {
        if (property === 'location') return fakeLocation;
        return Reflect.get(target, property, receiver);
      },
    }));

    render(<ModernTheme shop={SHOP} products={[PRODUCTS[0], PRODUCTS[1]]} />);
    addProduct('A');
    addProduct('Sweet Box');
    openCheckout();
    fillRequiredCheckout({ marketing: true });
    fireEvent.click(screen.getByRole('button', { name: '📒 Add to Khata' }));

    const submit = screen.getByRole('button', { name: 'Place Order on WhatsApp' });
    fireEvent.click(submit);
    expect(await screen.findByText('Stock changed')).toBeInTheDocument();
    expect(fakeLocation.href).toBe('http://localhost:3000/');

    const firstPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(firstPayload).toEqual({
      shop_id: SHOP.id,
      customer_name: 'Buyer',
      customer_phone: '9876543210',
      delivery_address: 'MG Road',
      payment_method: 'khata',
      data_consent: true,
      marketing_consent: true,
      idempotency_key: firstKey,
      items: [
        { product_id: 'product-a', quantity: 1 },
        { product_id: 'product-sweet', quantity: 1 },
      ],
    });

    fireEvent.click(submit);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retryPayload = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(retryPayload.idempotency_key).toBe(firstKey);

    const expectedMessage = [
      '*New Order from Ganesh Tyres Store*',
      '',
      '*Order No:* ON/2026-27/00009',
      '*Customer:*   Buyer  ',
      '*Phone:* 9876543210',
      '*Address:*   MG Road  ',
      '*Payment:* Khata (Pay Later)',
      '',
      '*Order Items:*',
      '1x A — ₹50',
      '1x Sweet Box — ₹123',
      '',
      '*Total: ₹60*',
    ].join('\n');
    expect(fakeLocation.href).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent(expectedMessage)}`
    );
    expect(screen.queryByRole('heading', { name: 'Your Order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Checkout/ })).not.toBeInTheDocument();

    addProduct('A');
    openCheckout();
    fillRequiredCheckout();
    fireEvent.click(screen.getByRole('button', { name: 'Place Order on WhatsApp' }));
    expect(await screen.findByText('Network error: offline')).toBeInTheDocument();
    const nextPayload = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(nextPayload.idempotency_key).toBe(nextKey);
    expect(fakeLocation.href).toContain('ON%2F2026-27%2F00009');
  });
});
