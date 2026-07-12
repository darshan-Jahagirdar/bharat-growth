import type { PaymentMode } from '@/lib/types/database';

export const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'credit'];

export const PAYMENT_LABELS: Record<PaymentMode, string> = {
  cash: '₹ Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
  split: 'Split',
  online_upi: 'Online UPI',
  online_khata: 'Online Khata',
};
