import type { ReactNode } from 'react';
import { requireShopPageAccess } from '@/lib/auth/requireShopPageAccess';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireShopPageAccess('/dashboard');
  return children;
}
