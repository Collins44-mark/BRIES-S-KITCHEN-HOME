'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Tags,
  Warehouse,
  Truck,
  Building2,
  Receipt,
  HandCoins,
  Users,
  BarChart3,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { BrandLogo, ProfileAvatar } from '@/components/brand/brand-logo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS / Sales', icon: ShoppingCart },
  { href: '/sales', label: 'Sales History', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/purchases', label: 'Purchases', icon: Truck },
  { href: '/suppliers', label: 'Suppliers', icon: Building2 },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/debts', label: 'Debts / Credit', icon: HandCoins },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setProfileOpen(false);
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const roleLabel =
    user?.role === 'ADMIN' ? 'Administrator' : user?.role.replaceAll('_', ' ') ?? '';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside
        className="relative z-10 flex h-full w-[min(280px,86vw)] flex-col overflow-y-auto border-r border-white/70 bg-white/78 text-slate-800 shadow-[8px_0_40px_rgba(15,23,42,0.08)] backdrop-blur-[28px] saturate-[140%]"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-start gap-3 px-4 pb-4 pt-5">
          <BrandLogo size={40} className="ring-1 ring-black/5" rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold leading-snug tracking-wide text-slate-900">
              BRIE&apos;S HOME &amp; KITCHEN
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-slate-500">
              Quality for a Better Home
            </p>
          </div>
          <button
            type="button"
            className="glass-control flex h-8 w-8 items-center justify-center text-slate-600"
            onClick={() => onOpenChange(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pb-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                  active
                    ? 'bg-slate-900 text-white shadow-soft'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-white' : 'text-slate-500',
                  )}
                />
                <span className="truncate font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="mt-auto border-t border-slate-200/60 p-3" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-white/80 bg-white/55 px-2.5 py-2 text-left shadow-soft backdrop-blur-md transition hover:bg-white/80"
            >
              <ProfileAvatar name={displayName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-[11px] text-slate-500">{roleLabel}</p>
              </div>
            </button>
            {profileOpen && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-toast backdrop-blur-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
