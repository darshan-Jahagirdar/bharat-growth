'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  ClipboardList,
  History,
  Settings,
  LogOut,
  FileStack,
  Megaphone,
} from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    label: 'Billing',
    href: '/billing',
    icon: <ShoppingBag className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Products',
    href: '/dashboard/products',
    icon: <Package className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'New Purchase',
    href: '/dashboard/purchases/new',
    icon: <ClipboardList className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Purchase Log',
    href: '/dashboard/purchases/history',
    icon: <History className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Orders',
    href: '/dashboard/orders',
    icon: <FileStack className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Campaigns',
    href: '/dashboard/campaigns',
    icon: <Megaphone className="w-4 h-4" />,
    exact: true,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-4 h-4" />,
    exact: true,
  },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  function isActive(link: NavLink): boolean {
    if (link.exact) return pathname === link.href;
    return pathname.startsWith(link.href);
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between h-12 px-4">
        {/* Brand */}
        <a href="/billing" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs">
            B
          </div>
          <span className="text-sm font-bold tracking-tight">
            <span className="text-white">Bharat</span>
            <span className="text-orange-500">Growth</span>
          </span>
        </a>

        {/* Center nav links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = isActive(link);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`
                  relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium
                  transition-colors duration-200
                  ${active
                    ? 'text-orange-400'
                    : 'text-gray-400 hover:text-orange-400'
                  }
                `}
              >
                {link.icon}
                <span>{link.label}</span>
                {/* Active indicator glow */}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-gray-500 hover:text-gray-300 border border-transparent
                     hover:border-white/10 hover:bg-white/5 transition-all duration-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{signingOut ? 'Signing out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}
