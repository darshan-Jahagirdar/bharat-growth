import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PurchaseOrderRow,
  SalesOrderRow,
} from '@/lib/orders/orderQueries';
import OrdersPage from '../page';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  checkUserOnboarded: vi.fn(),
  fetchSalesOrders: vi.fn(),
  fetchPurchaseOrders: vi.fn(),
  convertSalesOrder: vi.fn(),
  convertPurchaseOrder: vi.fn(),
  cancelSalesOrder: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
}));

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/lib/orders/orderQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/orders/orderQueries')>();
  return {
    ...actual,
    fetchSalesOrders: mocks.fetchSalesOrders,
    fetchPurchaseOrders: mocks.fetchPurchaseOrders,
    convertSalesOrder: mocks.convertSalesOrder,
    convertPurchaseOrder: mocks.convertPurchaseOrder,
    cancelSalesOrder: mocks.cancelSalesOrder,
    cancelPurchaseOrder: mocks.cancelPurchaseOrder,
  };
});

const SALES_ORDER: SalesOrderRow = {
  id: 'so-1',
  so_number: 'SO/2026-27/00001',
  so_sequence: 1,
  financial_year: '2026-27',
  customer_id: 'customer-1',
  customer_name: 'Rajesh Sharma',
  customer_phone: '98765 43210',
  status: 'reserved',
  valid_until: '2026-07-20',
  total_amount_paise: 448_000,
  notes: 'Keep ready for pickup',
  created_at: '2026-07-13T04:30:00.000Z',
  updated_at: '2026-07-13T04:30:00.000Z',
  items: [{
    id: 'so-item-1',
    product_id: 'product-1',
    quantity: 2,
    agreed_price_paise: 224_000,
    product_name: 'CEAT SecuraDrive',
    product_unit: 'piece',
  }],
};

const PURCHASE_ORDER: PurchaseOrderRow = {
  id: 'po-1',
  po_number: 'PO/2026-27/00001',
  po_sequence: 1,
  financial_year: '2026-27',
  supplier_name: 'Mumbai Tyre Supply',
  status: 'sent',
  expected_date: '2026-07-20',
  total_amount_paise: 300_000,
  notes: 'Call before dispatch',
  created_at: '2026-07-13T04:30:00.000Z',
  updated_at: '2026-07-13T04:30:00.000Z',
  items: [{
    id: 'po-item-1',
    product_id: 'product-2',
    quantity: 3,
    expected_price_paise: 100_000,
    product_name: 'MRF Zapper',
    product_unit: 'piece',
  }],
};

function renderPage() {
  return render(<OrdersPage />);
}

beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
  mocks.fetchSalesOrders.mockResolvedValue({
    rows: [SALES_ORDER],
    hasMore: false,
  });
  mocks.fetchPurchaseOrders.mockResolvedValue({
    rows: [PURCHASE_ORDER],
    hasMore: false,
  });
  mocks.convertSalesOrder.mockResolvedValue({
    success: true,
    data: { invoice_number: 'BG/2026-27/00002' },
    error: null,
  });
  mocks.convertPurchaseOrder.mockResolvedValue({
    success: true,
    data: { bill_number: 'PB/2026-27/00001' },
    error: null,
  });
  mocks.cancelSalesOrder.mockResolvedValue({
    success: true,
    data: null,
    error: null,
  });
  mocks.cancelPurchaseOrder.mockResolvedValue({
    success: true,
    data: null,
    error: null,
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Orders page behavior contract before decomposition', () => {
  it('loads sales orders first and lazy-loads purchase orders on the first tab switch', async () => {
    renderPage();

    expect(await screen.findByText(SALES_ORDER.so_number)).toBeInTheDocument();
    expect(mocks.fetchSalesOrders).toHaveBeenCalledWith('shop-1', 0);
    expect(mocks.fetchPurchaseOrders).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Purchase Orders/ }));

    expect(await screen.findByText(PURCHASE_ORDER.po_number)).toBeInTheDocument();
    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledWith('shop-1', 0);

    fireEvent.click(screen.getByRole('button', { name: /Sales Orders/ }));
    fireEvent.click(screen.getByRole('button', { name: /Purchase Orders/ }));
    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(1);
  });

  it('preserves sales-order expansion, WhatsApp content, payment selection, and conversion', async () => {
    renderPage();
    const orderNumber = await screen.findByText(SALES_ORDER.so_number);

    fireEvent.click(orderNumber.closest('tr')!);
    expect(await screen.findByText('CEAT SecuraDrive')).toBeInTheDocument();
    expect(screen.getByText(/Qty: 2 piece/)).toBeInTheDocument();
    expect(screen.getByText(/Keep ready for pickup/)).toBeInTheDocument();

    const row = orderNumber.closest('tr')!;
    fireEvent.click(within(row).getByTitle('Share on WhatsApp'));
    const openedUrl = vi.mocked(window.open).mock.calls[0][0] as string;
    expect(openedUrl).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(decodeURIComponent(openedUrl)).toContain('RESERVATION CONFIRMED - Ganesh Tyres');
    expect(decodeURIComponent(openedUrl)).toContain('CEAT SecuraDrive x 2 = ₹4,480.00');
    expect(decodeURIComponent(openedUrl)).toContain('/store/shop-1');

    fireEvent.click(within(row).getByTitle('Convert to Invoice'));
    expect(screen.getByText('Convert to Invoice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Credit (Udhaar)' }));
    expect(screen.getByText(/udhaar balance/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));

    await waitFor(() => {
      expect(mocks.convertSalesOrder).toHaveBeenCalledWith('so-1', 'credit');
    });
    expect(await screen.findByText(/converted to Invoice BG\/2026-27\/00002/)).toBeInTheDocument();
    expect(mocks.fetchSalesOrders).toHaveBeenCalledTimes(2);
  });

  it('keeps confirmation text and tenant arguments on sales-order cancellation', async () => {
    renderPage();
    const orderNumber = await screen.findByText(SALES_ORDER.so_number);
    const row = orderNumber.closest('tr')!;

    fireEvent.click(within(row).getByTitle('Cancel Order'));

    expect(window.confirm).toHaveBeenCalledWith(
      `Cancel ${SALES_ORDER.so_number}? This cannot be undone.`
    );
    await waitFor(() => {
      expect(mocks.cancelSalesOrder).toHaveBeenCalledWith('so-1', 'shop-1');
    });
    expect(await screen.findByText(`${SALES_ORDER.so_number} cancelled`)).toBeInTheDocument();
  });

  it('preserves purchase-order expansion, sharing, and receive conversion', async () => {
    renderPage();
    await screen.findByText(SALES_ORDER.so_number);
    fireEvent.click(screen.getByRole('button', { name: /Purchase Orders/ }));
    const orderNumber = await screen.findByText(PURCHASE_ORDER.po_number);

    fireEvent.click(orderNumber.closest('tr')!);
    expect(await screen.findByText('MRF Zapper')).toBeInTheDocument();
    expect(screen.getByText(/Call before dispatch/)).toBeInTheDocument();

    const row = orderNumber.closest('tr')!;
    fireEvent.click(within(row).getByTitle('Share on WhatsApp'));
    const openedUrl = vi.mocked(window.open).mock.calls[0][0] as string;
    expect(openedUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(openedUrl)).toContain('PURCHASE ORDER - Ganesh Tyres');
    expect(decodeURIComponent(openedUrl)).toContain('MRF Zapper x 3');

    fireEvent.click(within(row).getByTitle('Receive Items'));
    expect(screen.getByText(/stock-in all items/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Receive & Stock In' }));

    await waitFor(() => {
      expect(mocks.convertPurchaseOrder).toHaveBeenCalledWith('po-1');
    });
    expect(await screen.findByText(/converted to Purchase Bill/)).toBeInTheDocument();
    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(2);
  });

  it('appends both order types using the current list length as the pagination offset', async () => {
    mocks.fetchSalesOrders
      .mockResolvedValueOnce({ rows: [SALES_ORDER], hasMore: true })
      .mockResolvedValueOnce({
        rows: [{ ...SALES_ORDER, id: 'so-2', so_number: 'SO/2026-27/00002' }],
        hasMore: false,
      });
    mocks.fetchPurchaseOrders
      .mockResolvedValueOnce({ rows: [PURCHASE_ORDER], hasMore: true })
      .mockResolvedValueOnce({
        rows: [{ ...PURCHASE_ORDER, id: 'po-2', po_number: 'PO/2026-27/00002' }],
        hasMore: false,
      });

    renderPage();
    await screen.findByText(SALES_ORDER.so_number);
    fireEvent.click(screen.getByRole('button', { name: 'Load More Orders' }));
    expect(await screen.findByText('SO/2026-27/00002')).toBeInTheDocument();
    expect(mocks.fetchSalesOrders).toHaveBeenLastCalledWith('shop-1', 1);

    fireEvent.click(screen.getByRole('button', { name: /Purchase Orders/ }));
    await screen.findByText(PURCHASE_ORDER.po_number);
    fireEvent.click(screen.getByRole('button', { name: 'Load More Orders' }));
    expect(await screen.findByText('PO/2026-27/00002')).toBeInTheDocument();
    expect(mocks.fetchPurchaseOrders).toHaveBeenLastCalledWith('shop-1', 1);
  });
});
