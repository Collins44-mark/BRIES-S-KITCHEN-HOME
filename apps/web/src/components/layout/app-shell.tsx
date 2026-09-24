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

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', mobileOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [mobileOpen]);

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
    <div className="min-h-screen max-w-[100vw] overflow-x-clip">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          'relative flex min-h-screen max-w-full flex-col transition-[margin] duration-300',
          collapsed ? 'lg:ml-[84px]' : 'lg:ml-[250px]',
        )}
      >
        <header className="sticky top-0 z-30">
          <TopHeader onToggleSidebar={toggleSidebar} />
        </header>

        {pathname.startsWith('/dashboard') && <WelcomeToast />}

        <main className="min-w-0 flex-1 px-4 pb-6 pt-4 sm:px-5 lg:px-6">{children}</main>

        <footer className="flex flex-col gap-1 px-4 pb-4 text-[11px] text-slate-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:px-5 lg:px-6">
          <span className="break-words">
            © 2026 BRIE&apos;S HOME &amp; KITCHEN. All rights reserved.
          </span>
          <span>Better Homes. Better Living.</span>
        </footer>
      </div>
    </div>
  );
}
