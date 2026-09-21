'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { DateRangePreset } from '@bries/types';

interface DateRangeContextValue {
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset) => void;
  from?: string;
  to?: string;
  setCustomRange: (from: string, to: string) => void;
  label: string;
}

const LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  this_month: 'This Month',
  custom: 'Custom Range',
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<DateRangePreset>('today');
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();

  const setPreset = (next: DateRangePreset) => {
    setPresetState(next);
    if (next !== 'custom') {
      setFrom(undefined);
      setTo(undefined);
    }
  };

  const setCustomRange = (nextFrom: string, nextTo: string) => {
    setPresetState('custom');
    setFrom(nextFrom);
    setTo(nextTo);
  };

  const value = useMemo(
    () => ({
      preset,
      setPreset,
      from,
      to,
      setCustomRange,
      label: LABELS[preset],
    }),
    [preset, from, to],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
