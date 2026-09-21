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
    <div className="glass-card relative flex min-h-[118px] flex-col justify-between p-[18px] transition duration-200 hover:bg-white/72">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <GlassIcon icon={icon} tone={tone} />
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-300 transition hover:bg-white/50 hover:text-slate-500"
          aria-label={`${label} options`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 pl-[0.15rem]">
        <p className="text-[1.65rem] font-semibold leading-none tracking-tight text-slate-900">
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              'mt-2 text-[12px]',
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
