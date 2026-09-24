'use client';

import type { LucideIcon } from 'lucide-react';
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
    <div className="glass-card relative flex min-h-0 flex-col justify-between gap-2.5 p-3.5 transition duration-200 hover:bg-white/72 sm:min-h-[108px] sm:p-4 lg:p-[18px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <GlassIcon icon={icon} tone={tone} />
        <p className="truncate text-[11px] font-medium leading-snug text-slate-500 sm:text-[13px]">
          {label}
        </p>
      </div>
      <div className="min-w-0">
        <p className="kpi-value">{value}</p>
        {hint && (
          <p
            className={cn(
              'mt-1 text-[10px] leading-snug sm:mt-1.5 sm:text-[12px]',
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
