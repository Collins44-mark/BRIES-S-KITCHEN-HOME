'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { WelcomeToast } from './welcome-toast';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => !value);
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          'relative flex min-h-screen flex-col transition-[margin] duration-300',
          collapsed ? 'lg:ml-[84px]' : 'lg:ml-[250px]',
        )}
      >
        <header className="sticky top-0 z-30">
          <TopHeader onToggleSidebar={toggleSidebar} />
        </header>

        {pathname.startsWith('/dashboard') && <WelcomeToast />}

        <main className="flex-1 px-5 pb-6 pt-4 lg:px-6">{children}</main>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 text-[11px] text-slate-400 lg:px-6">
          <span>© 2026 BRIE&apos;S HOME &amp; KITCHEN. All rights reserved.</span>
          <span>Better Homes. Better Living.</span>
        </footer>
      </div>
    </div>
  );
}
