// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccessRequestForm from '../AccessRequestForm';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'access_requests') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { insert: mocks.insert };
    },
  }),
}));

describe('AccessRequestForm', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('submits only requester-controlled fields and refreshes the server state', async () => {
    const user = userEvent.setup();
    render(
      <AccessRequestForm
        defaultEmail="OWNER@Example.Test"
        userId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.type(screen.getByLabelText('Full name'), 'Darshan');
    await user.type(screen.getByLabelText('Business name'), 'Growth Store');
    await user.selectOptions(screen.getByLabelText('Business type'), 'grocery');
    await user.type(screen.getByLabelText('City'), 'Pune');
    await user.click(
      screen.getByRole('button', { name: 'Request early access' })
    );

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: '11111111-1111-4111-8111-111111111111',
      full_name: 'Darshan',
      business_name: 'Growth Store',
      business_type: 'grocery',
      city: 'Pune',
      email: 'owner@example.test',
    });
    expect(mocks.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.anything(),
        reviewed_at: expect.anything(),
      })
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('keeps the form in place when the request write fails', async () => {
    mocks.insert.mockResolvedValueOnce({
      error: { code: '42501', message: 'denied' },
    });
    const user = userEvent.setup();
    render(
      <AccessRequestForm
        defaultEmail="owner@example.test"
        userId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.type(screen.getByLabelText('Full name'), 'Darshan');
    await user.type(screen.getByLabelText('Business name'), 'Growth Store');
    await user.type(screen.getByLabelText('City'), 'Pune');
    await user.click(
      screen.getByRole('button', { name: 'Request early access' })
    );

    expect(
      await screen.findByText('We could not submit your request. Please try again.')
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
