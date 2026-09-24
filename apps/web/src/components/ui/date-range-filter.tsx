'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { DateRangePreset } from '@bries/types';
import { useDateRange } from '@/contexts/date-range-context';
import { useLocale } from '@/contexts/locale-context';
import { cn } from '@/lib/utils';

const DATE_OPTIONS: { value: DateRangePreset; labelKey: string }[] = [
  { value: 'today', labelKey: 'date.today' },
  { value: 'yesterday', labelKey: 'date.yesterday' },
  { value: 'this_week', labelKey: 'date.thisWeek' },
  { value: 'this_month', labelKey: 'date.thisMonth' },
  { value: 'custom', labelKey: 'date.custom' },
];

/** Compact glass date filter for page headers (not the global top bar). */
export function DateRangeFilter({ className }: { className?: string }) {
  const { preset, setPreset, label, setCustomRange } = useDateRange();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className={cn('relative shrink-0', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-control flex h-9 items-center gap-1.5 px-3 text-[12px] text-slate-700 sm:h-10 sm:text-[13px]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="max-w-[7.5rem] truncate font-medium sm:max-w-none">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[180px] overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-toast backdrop-blur-xl">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={preset === opt.value}
              className={cn(
                'flex w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50',
                preset === opt.value && 'bg-slate-100 font-medium',
              )}
              onClick={() => {
                if (opt.value === 'custom') {
                  const from = prompt(t('common.fromDatePrompt'));
                  const to = prompt(t('common.toDatePrompt'));
                  if (from && to) setCustomRange(from, to);
                } else {
                  setPreset(opt.value);
                }
                setOpen(false);
              }}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
