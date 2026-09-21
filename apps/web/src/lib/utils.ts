import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTzs(value: string | number) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'TZS 0';
  return `TZS ${new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 0,
  }).format(num)}`;
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
