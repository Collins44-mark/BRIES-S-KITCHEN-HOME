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
import { useLocale } from '@/contexts/locale-context';
import { BrandLogo, ProfileAvatar } from '@/components/brand/brand-logo';

const NAV = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/pos', labelKey: 'nav.pos', icon: ShoppingCart },
  { href: '/sales', labelKey: 'nav.sales', icon: ClipboardList },
  { href: '/products', labelKey: 'nav.products', icon: Package },
  { href: '/categories', labelKey: 'nav.categories', icon: Tags },
  { href: '/inventory', labelKey: 'nav.inventory', icon: Warehouse },
  { href: '/purchases', labelKey: 'nav.purchases', icon: Truck },
  { href: '/suppliers', labelKey: 'nav.suppliers', icon: Building2 },
  { href: '/expenses', labelKey: 'nav.expenses', icon: Receipt },
  { href: '/debts', labelKey: 'nav.debts', icon: HandCoins },
  { href: '/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings },
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
  const { t } = useLocale();
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
    user?.role === 'ADMIN' ? t('common.owner') : user?.role.replaceAll('_', ' ') ?? '';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-slate-900/15 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside
        className="relative z-10 m-3 flex max-h-[calc(100dvh-1.5rem)] w-[min(290px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-[rgba(255,255,255,0.78)] text-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[28px] saturate-[140%] sm:m-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[min(300px,calc(100vw-2rem))]"
        role="dialog"
        aria-modal="true"
        aria-label={t('common.navLabel')}
      >
        <div className="relative shrink-0 px-5 pb-3 pt-5">
          <button
            type="button"
            className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/85 bg-white/55 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md transition hover:bg-white/75"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.closeSidebar')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>

          <div className="flex flex-col items-center px-2 text-center">
            <BrandLogo
              size={56}
              className="ring-1 ring-black/5 shadow-[0_6px_18px_rgba(15,23,42,0.1)]"
              rounded="rounded-full"
            />
            <p className="mt-3 max-w-full text-balance text-[13.5px] font-semibold leading-snug tracking-[-0.02em] text-slate-900 sm:text-[14.5px]">
              BRIE&apos;S HOME &amp; KITCHEN
            </p>
            <p className="mt-1 max-w-[15rem] text-[11px] font-medium leading-snug text-slate-500 sm:text-[11.5px]">
              Quality for a Better Home
            </p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'group flex min-h-[46px] items-center gap-3 rounded-2xl px-3.5 text-[13.5px] transition-all duration-150',
                  active
                    ? 'border border-white/15 bg-[rgba(15,23,42,0.88)] text-white shadow-[0_8px_20px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.14)]'
                    : 'border border-transparent text-slate-600 hover:border-white/60 hover:bg-white/55 hover:text-slate-900',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700',
                  )}
                  strokeWidth={1.85}
                />
                <span className="font-medium tracking-[-0.01em]">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="shrink-0 px-3 pb-3 pt-1" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-[18px] border border-white/80 bg-white/55 px-3 py-2.5 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md transition hover:bg-white/70"
            >
              <ProfileAvatar name={displayName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-[11px] text-slate-500">{roleLabel}</p>
              </div>
            </button>
            {profileOpen && (
              <div className="mt-2 overflow-hidden rounded-[18px] border border-white/80 bg-white/92 p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.1)] backdrop-blur-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50/80"
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.signOut')}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
