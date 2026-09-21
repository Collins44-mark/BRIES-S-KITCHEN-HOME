'use client';

import { Bell, CalendarDays, ChevronDown, LogOut, MoreHorizontal, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DateRangePreset } from '@bries/types';
import { useAuth } from '@/contexts/auth-context';
import { useDateRange } from '@/contexts/date-range-context';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ProfileAvatar } from '@/components/brand/brand-logo';

const DATE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

export function TopHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user, logout } = useAuth();
  const { preset, setPreset, label, setCustomRange } = useDateRange();
  const [dateOpen, setDateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';

  return (
    <header className="glass-header relative z-30 flex flex-wrap items-center gap-2.5 px-5 py-2.5 lg:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/55 text-slate-700 shadow-soft backdrop-blur-xl transition hover:bg-white/80"
        aria-label="Toggle sidebar"
        title="Open / close sidebar"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      <div className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="global-search"
          type="search"
          placeholder="Search products, customers, or scan barcode..."
          className="h-10 w-full rounded-xl border border-white/70 bg-white/55 pl-10 pr-14 text-[13px] text-slate-700 shadow-soft outline-none backdrop-blur-xl placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
        />
        <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative" ref={dateRef}>
          <button
            type="button"
            onClick={() => setDateOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/55 px-3 text-[13px] text-slate-700 shadow-soft backdrop-blur-xl"
          >
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="font-medium">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {dateOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[180px] overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-toast backdrop-blur-xl">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    'flex w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                    preset === opt.value && 'bg-slate-100 font-medium',
                  )}
                  onClick={() => {
                    if (opt.value === 'custom') {
                      const from = prompt('From date (YYYY-MM-DD)');
                      const to = prompt('To date (YYYY-MM-DD)');
                      if (from && to) setCustomRange(from, to);
                    } else {
                      setPreset(opt.value);
                    }
                    setDateOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/55 text-slate-600 shadow-soft backdrop-blur-xl"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/55 px-2 pr-2.5 shadow-soft backdrop-blur-xl"
          >
            <ProfileAvatar name={displayName} size={28} />
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-medium leading-tight text-slate-800">{displayName}</p>
              <p className="text-[10.5px] leading-tight text-slate-500">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.role.replaceAll('_', ' ')}
              </p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[180px] overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-toast backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
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
      </div>
    </header>
  );
}
