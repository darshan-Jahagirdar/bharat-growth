import type { ReactNode } from 'react';
import { requireShopPageAccess } from '@/lib/auth/requireShopPageAccess';

export default async function BillingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireShopPageAccess('/billing');
  return children;
}
