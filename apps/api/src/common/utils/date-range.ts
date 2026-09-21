import { DateRangePreset } from '@bries/types';

export interface ResolvedDateRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function resolveDateRange(
  preset: DateRangePreset = 'today',
  from?: string,
  to?: string,
): ResolvedDateRange {
  const now = new Date();

  if (preset === 'custom' && from && to) {
    const rangeFrom = startOfDay(new Date(from));
    const rangeTo = endOfDay(new Date(to));
    const duration = rangeTo.getTime() - rangeFrom.getTime();
    return {
      from: rangeFrom,
      to: rangeTo,
      previousFrom: new Date(rangeFrom.getTime() - duration - 1),
      previousTo: new Date(rangeFrom.getTime() - 1),
    };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const fromD = startOfDay(yesterday);
    const toD = endOfDay(yesterday);
    const prev = new Date(yesterday);
    prev.setDate(prev.getDate() - 1);
    return {
      from: fromD,
      to: toD,
      previousFrom: startOfDay(prev),
      previousTo: endOfDay(prev),
    };
  }

  if (preset === 'this_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const fromD = startOfDay(monday);
    const toD = endOfDay(now);
    const duration = toD.getTime() - fromD.getTime();
    return {
      from: fromD,
      to: toD,
      previousFrom: new Date(fromD.getTime() - duration - 1),
      previousTo: new Date(fromD.getTime() - 1),
    };
  }

  if (preset === 'this_month') {
    const fromD = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const toD = endOfDay(now);
    const prevMonthEnd = new Date(fromD.getTime() - 1);
    const prevMonthStart = startOfDay(
      new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1),
    );
    return {
      from: fromD,
      to: toD,
      previousFrom: prevMonthStart,
      previousTo: endOfDay(prevMonthEnd),
    };
  }

  // today (default)
  const fromD = startOfDay(now);
  const toD = endOfDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    from: fromD,
    to: toD,
    previousFrom: startOfDay(yesterday),
    previousTo: endOfDay(yesterday),
  };
}
