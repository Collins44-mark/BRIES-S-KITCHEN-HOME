'use client';

import { Bell, MoreHorizontal, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useLocale } from '@/contexts/locale-context';

export function TopHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useLocale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="glass-header relative z-30 px-4 py-2.5 sm:px-5 lg:px-6">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="glass-control flex h-10 w-10 shrink-0 items-center justify-center text-slate-700 transition hover:bg-white/80 sm:h-11 sm:w-11"
          aria-label={t('common.toggleSidebar')}
          title={t('common.toggleSidebar')}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <div className="relative mx-auto min-w-0 max-w-md flex-1 lg:max-w-lg">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="global-search"
            type="search"
            placeholder={t('common.searchPlaceholder')}
            className="glass-control h-10 w-full pl-10 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-white/90 focus:ring-2 focus:ring-sky-100/50 sm:h-11 sm:pl-11 sm:pr-12 sm:text-[14px]"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200/60 bg-white/55 px-1.5 py-0.5 text-[10px] text-slate-400 lg:inline">
            ⌘ K
          </kbd>
        </div>

        <button
          type="button"
          className="glass-control relative flex h-10 w-10 shrink-0 items-center justify-center text-slate-600 transition hover:bg-white/80 sm:h-11 sm:w-11"
          aria-label={t('common.notifications')}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white/80" />
        </button>
      </div>
    </header>
  );
}
