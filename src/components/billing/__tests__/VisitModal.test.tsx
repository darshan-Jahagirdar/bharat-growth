import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectedCustomer } from '@/lib/billing/useBillingStore';
import { VisitModal } from '../VisitModal';

const mocks = vi.hoisted(() => ({
  fetchVisitTags: vi.fn(),
  logCustomerVisit: vi.fn(),
  setCustomerQuery: vi.fn(),
  setShowCustomerDropdown: vi.fn(),
}));

const CUSTOMER: SelectedCustomer = {
  id: 'customer-1',
  phoneNumber: '9876543210',
  name: 'Test Customer',
  loyaltyPoints: 12,
  gstin: null,
  segment: 'regular',
  creditBalancePaise: 0,
  photoUrl: null,
};

vi.mock('@/lib/billing/billingVisitQueries', () => ({
  fetchVisitTags: mocks.fetchVisitTags,
  logCustomerVisit: mocks.logCustomerVisit,
}));

vi.mock('@/lib/billing/useBillingSearch', () => ({
  useBillingSearch: () => ({
    customerQuery: 'te',
    setCustomerQuery: mocks.setCustomerQuery,
    showCustomerDropdown: true,
    setShowCustomerDropdown: mocks.setShowCustomerDropdown,
    filteredCustomers: [CUSTOMER],
  }),
}));

describe('VisitModal', () => {
  beforeEach(() => {
    mocks.fetchVisitTags.mockResolvedValue([{ id: 'tag-1', name: 'Tyres' }]);
    mocks.logCustomerVisit.mockResolvedValue(undefined);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('records a returning customer with optional category and the exact consent capture', async () => {
    render(
      <VisitModal
        isOpen
        shopId="shop-1"
        supabaseConfigured
        demoMode={false}
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseDown(screen.getByText('Test Customer'));
    await screen.findByRole('option', { name: 'Tyres' });
    fireEvent.change(screen.getByLabelText(/Interest category/), {
      target: { value: 'tag-1' },
    });
    expect(
      screen.getByText('Ask before ticking. Consent is optional and can be withdrawn at any time.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/purchase acknowledgements, loyalty updates, and offers/));
    fireEvent.click(screen.getByRole('button', { name: 'Record Visit' }));

    await waitFor(() => {
      expect(mocks.logCustomerVisit).toHaveBeenCalledWith({
        request_id: '11111111-1111-4111-8111-111111111111',
        phone_number: '+919876543210',
        customer_name: 'Test Customer',
        tag_id: 'tag-1',
        marketing_consent: true,
      });
    });
    expect(screen.getByText('Visit recorded. 1 loyalty point added.')).toBeInTheDocument();
  });

  it('keeps one request id across a retry and never sends bill amount or items', async () => {
    mocks.logCustomerVisit
      .mockRejectedValueOnce(new Error('Network interrupted'))
      .mockResolvedValueOnce(undefined);

    render(
      <VisitModal
        isOpen
        shopId="shop-1"
        supabaseConfigured
        demoMode={false}
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: /Add new customer: te/ }));
    fireEvent.change(screen.getByLabelText(/Phone number/), {
      target: { value: '9876543210' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record Visit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network interrupted');

    fireEvent.click(screen.getByRole('button', { name: 'Record Visit' }));
    await waitFor(() => expect(mocks.logCustomerVisit).toHaveBeenCalledTimes(2));

    const [first, second] = mocks.logCustomerVisit.mock.calls.map(([input]) => input);
    expect(first.request_id).toBe(second.request_id);
    expect(first).not.toHaveProperty('amount');
    expect(first).not.toHaveProperty('items');
    expect(first).not.toHaveProperty('customer_id');
  });
});
