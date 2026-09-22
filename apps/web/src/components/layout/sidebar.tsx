'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { BrandLogo } from '@/components/brand/brand-logo';

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
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const content = (
    <aside
      className={cn(
        'flex h-full flex-col overflow-y-auto bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-[84px]' : 'w-[250px]',
      )}
    >
      <div className={cn('flex items-start gap-3 px-4 pb-5 pt-6', collapsed && 'justify-center px-3')}>
        <BrandLogo size={40} className="ring-1 ring-white/10" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold leading-snug tracking-wide text-white">
              BRIE&apos;S HOME &amp; KITCHEN
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-sidebar-muted">
              Quality for a Better Home
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onMobileOpenChange(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                active
                  ? 'bg-sidebar-active text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.25)]'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-sky-300')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 p-4">
        {!collapsed && user && (
          <div className="mb-3 px-1">
            <p className="truncate text-xs font-medium text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">{user.role.replace('_', ' ')}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="hidden w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-sidebar-muted transition hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen lg:block',
          collapsed ? 'w-[84px]' : 'w-[250px]',
        )}
      >
        {content}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => onMobileOpenChange(false)} />
          <div className="relative z-10 h-full shadow-2xl">
            <aside className="flex h-full w-[250px] flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
              <div className="flex items-start gap-3 px-4 pb-5 pt-6">
                <BrandLogo size={40} className="ring-1 ring-white/10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold leading-snug tracking-wide text-white">
                    BRIE&apos;S HOME &amp; KITCHEN
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] text-sidebar-muted">
                    Quality for a Better Home
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-white/10 p-1.5 text-white"
                  onClick={() => onMobileOpenChange(false)}
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 px-3">
                {NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onMobileOpenChange(false)}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                        active
                          ? 'bg-sidebar-active text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.25)]'
                          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-sky-300')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
