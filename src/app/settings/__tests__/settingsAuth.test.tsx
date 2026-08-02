import { cleanup, render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { middleware } from '@/middleware';
import SettingsPage from '../page';

const mocks = vi.hoisted(() => ({
  browserGetSession: vi.fn(),
  checkUserOnboarded: vi.fn(),
  createServerClient: vi.fn(),
  serverGetSession: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mocks.browserGetSession } }),
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: mocks.checkUserOnboarded,
}));

vi.mock('@/components/layout/TopNav', () => ({
  default: () => <nav>Top navigation</nav>,
}));

vi.mock('../TaxSettings', () => ({
  default: ({ shopId }: { shopId: string }) => <div>Tax settings for {shopId}</div>,
}));

beforeEach(() => {
  mocks.serverGetSession.mockResolvedValue({ data: { session: null } });
  mocks.createServerClient.mockReturnValue({
    auth: { getSession: mocks.serverGetSession },
  });

  mocks.browserGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mocks.checkUserOnboarded.mockResolvedValue({
    shopId: 'shop-1',
    shopName: 'Ganesh Tyres',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('settings authentication', () => {
  it('redirects an unauthenticated request to login with the exact next route', async () => {
    const response = await middleware(
      new NextRequest('https://staging.example.com/settings')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://staging.example.com/login?next=%2Fsettings'
    );
  });

  it('renders settings for an authenticated, onboarded user', async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Ganesh Tyres')).toBeInTheDocument();
    expect(screen.getByText('Tax settings for shop-1')).toBeInTheDocument();
  });
});
