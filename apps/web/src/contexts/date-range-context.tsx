'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { DateRangePreset } from '@bries/types';
import { useLocale } from '@/contexts/locale-context';

interface DateRangeContextValue {
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset) => void;
  from?: string;
  to?: string;
  setCustomRange: (from: string, to: string) => void;
  label: string;
}

const DATE_KEYS: Record<DateRangePreset, string> = {
  today: 'date.today',
  yesterday: 'date.yesterday',
  this_week: 'date.thisWeek',
  this_month: 'date.thisMonth',
  custom: 'date.custom',
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
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
      label: t(DATE_KEYS[preset]),
    }),
    [preset, from, to, t],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
