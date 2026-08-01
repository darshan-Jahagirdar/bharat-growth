import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '@/lib/dashboard/dashboardQueries';
import DashboardPage from '../page';

const mocks = vi.hoisted(() => ({
  checkUserOnboarded: vi.fn(),
  downloadCSV: vi.fn(),
  exportGstReport: vi.fn(),
  fetchAllDashboardData: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

const DASHBOARD_DATA: DashboardData = {
  kpis: {
    todayRevenuePaise: 123_456,
    totalUdhaarPaise: 25_000,
    billsToday: 3,
    inventoryValuePaise: 450_000,
    monthlySalesPaise: 900_000,
    monthlyPurchasesPaise: 350_000,
    stockValueCostPaise: 275_000,
  },
  revenueTrend: [
    { date: 'Sun', fullDate: '12 Jul', revenue: 500 },
    { date: 'Mon', fullDate: '13 Jul', revenue: 734.56 },
  ],
  topProducts: [
    { name: 'Apollo Actigrip', sales: 1_000 },
    { name: 'CEAT Milaze', sales: 500 },
  ],
  khataCustomers: [{
    id: 'customer-1',
    name: 'Asha Stores',
    phone_number: '919876543210',
    photo_url: null,
    credit_balance_paise: 25_000,
    last_visit_at: '2026-07-12T00:00:00.000Z',
  }],
  lowStockProducts: [{
    id: 'product-low',
    name: 'MRF Zapper',
    quantity_in_stock: 2,
    unit: 'piece',
    reorder_level: 5,
  }],
  negativeStockProducts: [{
    product_id: 'product-negative',
    inventory_id: 'inventory-negative',
    name: 'Apollo Amazer',
    quantity_in_stock: -2,
    unit: 'piece',
  }],
  retentionStats: {
    messagesSent: 4,
    customersReturned: 2,
    revenueAttributedPaise: 50_000,
    activeRulesCount: 1,
    perRule: [],
  },
  captureMetrics: {
    billsWithCustomerPercent: 75,
    customerCaptures: 5,
    identifiedBills: 3,
    totalBills: 4,
    visits: 2,
  },
};

const shopQuery = {
  select: vi.fn(() => shopQuery),
  eq: vi.fn(() => shopQuery),
  single: vi.fn().mockResolvedValue({
    data: { business_name: 'Ganesh Tyres', campaigns_approved: true },
    error: null,
  }),
};

const supabase = {
  auth: { getSession: mocks.getSession },
  from: vi.fn(() => shopQuery),
  rpc: mocks.rpc,
};

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/lib/dashboard/dashboardQueries', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/dashboard/dashboardQueries')>();
  return {
    ...original,
    fetchAllDashboardData: mocks.fetchAllDashboardData,
    exportGstReport: mocks.exportGstReport,
  };
});

vi.mock('@/lib/utils/csvExport', () => ({
  downloadCSV: mocks.downloadCSV,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-13T06:30:00.000Z'));
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
  mocks.fetchAllDashboardData.mockResolvedValue(DASHBOARD_DATA);
  mocks.exportGstReport.mockResolvedValue([{ invoice_number: 'BG/2026-27/00001' }]);
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue({ sent: true }),
  }));
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Dashboard page behavior contract before decomposition', () => {
  it('resolves the shop, loads the default IST month, and renders progress metrics', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText('Ganesh Tyres')).toBeInTheDocument();
    expect(shopQuery.select).toHaveBeenCalledWith(
      'business_name, campaigns_approved'
    );
    expect(mocks.fetchAllDashboardData).toHaveBeenCalledWith('shop-1', {
      start: '2026-07-01T00:00:00+05:30',
      end: '2026-07-13T23:59:59+05:30',
    });
    expect(screen.getByText('₹1,234.56')).toBeInTheDocument();
    expect(screen.getByText('₹9,000.00')).toBeInTheDocument();
    expect(screen.getAllByText('₹500.00')).toHaveLength(2);
    expect(screen.getByText('Customer captures')).toBeInTheDocument();
    expect(screen.getByText('Bills with customer')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(
      screen.getByText('This Month: 3 identified bills + 2 visits')
    ).toBeInTheDocument();
    expect(screen.getByText('3 identified, 1 walk-in')).toBeInTheDocument();
    expect(screen.getByText('MRF Zapper')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Storefront/ })).toHaveAttribute(
      'href',
      '/store/shop-1'
    );
  });

  it('preserves preset and custom IST date-range payloads', async () => {
    const view = render(<DashboardPage />);
    await screen.findByText('Ganesh Tyres');

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => {
      expect(mocks.fetchAllDashboardData).toHaveBeenLastCalledWith('shop-1', {
        start: '2026-07-13T00:00:00+05:30',
        end: '2026-07-13T23:59:59+05:30',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const dateInputs = view.container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-06-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-30' } });
    await waitFor(() => {
      expect(mocks.fetchAllDashboardData).toHaveBeenLastCalledWith('shop-1', {
        start: '2026-06-01T00:00:00+05:30',
        end: '2026-06-30T23:59:59+05:30',
      });
    });
  });

  it('renders an honest no-bills state while still showing visit captures', async () => {
    mocks.fetchAllDashboardData.mockResolvedValueOnce({
      ...DASHBOARD_DATA,
      captureMetrics: {
        billsWithCustomerPercent: null,
        customerCaptures: 2,
        identifiedBills: 0,
        totalBills: 0,
        visits: 2,
      },
    });

    render(<DashboardPage />);

    expect(await screen.findByText('No bills')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(
      screen.getByText('This Month: 0 identified bills + 2 visits')
    ).toBeInTheDocument();
  });

  it('exports the current-month GST rows with the existing filename contract', async () => {
    render(<DashboardPage />);
    await screen.findByText('Ganesh Tyres');

    fireEvent.click(screen.getByRole('button', { name: /Download Tax Report/ }));

    await waitFor(() => {
      expect(mocks.exportGstReport).toHaveBeenCalledWith('shop-1');
      expect(mocks.downloadCSV).toHaveBeenCalledWith(
        [{ invoice_number: 'BG/2026-27/00001' }],
        'GST_Report_Ganesh_Tyres_Jul2026.csv'
      );
    });
    expect(screen.getByRole('button', { name: /Downloaded!/ })).toBeInTheDocument();
  });

  it('confirms a khata reminder and preserves its API payload', async () => {
    render(<DashboardPage />);
    await screen.findByText('Ganesh Tyres');

    fireEvent.click(screen.getByTitle('Send WhatsApp reminder to Asha Stores'));
    expect(screen.getByText('Send Reminder?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send Reminder' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/whatsapp/send-khata-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'customer-1' }),
      });
    });
    expect(screen.getByText('Reminder sent to Asha Stores')).toBeInTheDocument();
  });

  it('reconciles negative stock with the existing RPC payload and refresh behavior', async () => {
    render(<DashboardPage />);
    await screen.findByText('Ganesh Tyres');

    fireEvent.click(screen.getByRole('button', { name: 'Log Missing Delivery' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 20'), { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('adjust_stock', {
        p_shop_id: 'shop-1',
        p_product_id: 'product-negative',
        p_quantity_change: 3.5,
        p_movement_type: 'purchase',
        p_notes: 'Reconciliation: logged missing delivery of 3.5 piece',
        p_reference_id: null,
        p_reference_type: 'manual',
        p_allow_negative: true,
      });
      expect(mocks.fetchAllDashboardData).toHaveBeenLastCalledWith('shop-1');
    });
  });
});
