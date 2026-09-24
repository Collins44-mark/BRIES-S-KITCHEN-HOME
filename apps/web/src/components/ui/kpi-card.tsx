'use client';

import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { GlassIcon, type IconTone } from './glass-icon';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  hint,
  hintPositive,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  hintPositive?: boolean;
  icon: LucideIcon;
  tone: IconTone;
  compact?: boolean;
}) {
  return (
    <div className="glass-card relative flex min-h-0 flex-col justify-between gap-2 p-3 transition duration-200 hover:bg-white/72 sm:min-h-[108px] sm:gap-0 sm:p-4 lg:min-h-[118px] lg:p-[18px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <GlassIcon icon={icon} tone={tone} />
          <p className="truncate text-[11px] font-medium leading-snug text-slate-500 sm:text-[13px]">
            {label}
          </p>
        </div>
        <button
          type="button"
          className="hidden rounded-lg p-1 text-slate-300 transition hover:bg-white/50 hover:text-slate-500 sm:inline-flex"
          aria-label={`${label} options`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="min-w-0 pl-0.5">
        <p className="kpi-value text-slate-900">{value}</p>
        {hint && (
          <p
            className={cn(
              'mt-1 text-[10px] leading-snug sm:mt-2 sm:text-[12px]',
              hintPositive === true && 'font-medium text-emerald-600',
              hintPositive === false && 'font-medium text-rose-500',
              hintPositive === undefined && 'text-slate-400',
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
