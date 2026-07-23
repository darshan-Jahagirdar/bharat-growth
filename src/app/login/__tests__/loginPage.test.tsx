import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../page';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  sendOtp: vi.fn(),
  sendEmailOtp: vi.fn(),
  verifyOtp: vi.fn(),
  goBack: vi.fn(),
  clearError: vi.fn(),
  authState: {
    step: 'phone' as 'phone' | 'otp' | 'email_otp' | 'authenticated',
    user: null,
    loading: false,
    error: null as string | null,
    email: '',
    phone: '',
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('@/lib/auth/checkUserOnboarded', () => ({
  checkUserOnboarded: vi.fn(),
}));

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({
    ...mocks.authState,
    sendOtp: mocks.sendOtp,
    sendEmailOtp: mocks.sendEmailOtp,
    verifyOtp: mocks.verifyOtp,
    goBack: mocks.goBack,
    clearError: mocks.clearError,
  }),
}));

beforeEach(() => {
  mocks.authState.step = 'phone';
  mocks.authState.user = null;
  mocks.authState.loading = false;
  mocks.authState.error = null;
  mocks.authState.email = '';
  mocks.authState.phone = '';
  mocks.sendOtp.mockResolvedValue(true);
  mocks.sendEmailOtp.mockResolvedValue(true);
  mocks.verifyOtp.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('email OTP login UI', () => {
  it('sends an OTP from the email tab', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'owner+auth@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(mocks.sendEmailOtp).toHaveBeenCalledWith('owner+auth@example.com');
  });

  it('reuses six-cell paste, backspace, Enter, and resend behavior', () => {
    mocks.authState.step = 'email_otp';
    mocks.authState.email = 'owner+auth@example.com';

    render(<LoginPage />);

    const cells = screen.getAllByRole('textbox');
    expect(cells).toHaveLength(6);

    fireEvent.change(cells[0], { target: { value: 'x' } });
    expect(cells[0]).toHaveValue('');

    fireEvent.paste(cells[0], {
      clipboardData: { getData: () => '12 34-56' },
    });
    expect(cells.map((cell) => (cell as HTMLInputElement).value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);

    fireEvent.change(cells[5], { target: { value: '' } });
    fireEvent.keyDown(cells[5], { key: 'Backspace' });
    expect(cells[4]).toHaveFocus();

    fireEvent.change(cells[5], { target: { value: '6' } });
    fireEvent.keyDown(cells[5], { key: 'Enter' });
    expect(mocks.verifyOtp).toHaveBeenCalledWith('123456');

    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
    expect(mocks.sendEmailOtp).toHaveBeenCalledWith('owner+auth@example.com');
  });
});
