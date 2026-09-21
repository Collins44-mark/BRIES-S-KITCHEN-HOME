'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  green:
    'bg-emerald-50/85 text-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.14)]',
  purple:
    'bg-violet-50/85 text-violet-600 shadow-[0_0_16px_rgba(139,92,246,0.14)]',
  blue:
    'bg-sky-50/85 text-sky-600 shadow-[0_0_16px_rgba(14,165,233,0.14)]',
  red:
    'bg-rose-50/85 text-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.14)]',
  amber:
    'bg-amber-50/85 text-amber-600 shadow-[0_0_16px_rgba(245,158,11,0.14)]',
  slate:
    'bg-slate-100/85 text-slate-600 shadow-[0_0_16px_rgba(100,116,139,0.1)]',
} as const;

export type IconTone = keyof typeof TONE_STYLES;

export function GlassIcon({
  icon: Icon,
  tone = 'blue',
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  className?: string;
}) {
  return (
    <div className={cn('glass-icon', TONE_STYLES[tone], className)}>
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
    </div>
  );
}
