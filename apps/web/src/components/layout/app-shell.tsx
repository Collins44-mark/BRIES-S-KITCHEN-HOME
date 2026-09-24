'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { WelcomeToast } from './welcome-toast';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  /** Sidebar starts closed — only the three-dot trigger is visible. */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', sidebarOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [sidebarOpen]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-clip">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="relative flex min-h-screen max-w-full flex-col">
        <header className="sticky top-0 z-30">
          <TopHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        </header>

        {pathname.startsWith('/dashboard') && <WelcomeToast />}

        <main className="min-w-0 flex-1 px-4 pb-6 pt-4 sm:px-5 lg:px-6">{children}</main>

        <footer className="flex flex-col gap-1 px-4 pb-4 text-[11px] text-slate-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:px-5 lg:px-6">
          <span className="break-words">
            © 2026 BRIE&apos;S HOME &amp; KITCHEN. {t('common.allRights')}
          </span>
          <span>{t('common.taglineFooter')}</span>
        </footer>
      </div>
    </div>
  );
}
