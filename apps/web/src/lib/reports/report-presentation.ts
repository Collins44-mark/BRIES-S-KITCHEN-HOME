import { formatTzs } from '@/lib/utils';
import { paymentMethodLabel } from '@/lib/receipt/types';
import type { DateRangePreset } from '@bries/types';

export type ReportKey =
  | 'sales'
  | 'profit'
  | 'expenses'
  | 'inventory'
  | 'debts'
  | 'payments'
  | 'purchases';

export type ReportColumnKind = 'text' | 'money' | 'date' | 'datetime' | 'status' | 'method' | 'number';

export type ReportColumn = {
  key: string;
  label: string;
  kind: ReportColumnKind;
};

export const REPORT_TITLES: Record<ReportKey, string> = {
  sales: 'Sales Report',
  profit: 'Profit Report',
  expenses: 'Expenses Report',
  inventory: 'Inventory Report',
  debts: 'Debts Report',
  payments: 'Payments Report',
  purchases: 'Purchases Report',
};

/** Visible columns only — internal ids (UUID) are never included. */
export const REPORT_COLUMNS: Record<ReportKey, ReportColumn[]> = {
  sales: [
    { key: 'invoiceNumber', label: 'Invoice', kind: 'text' },
    { key: 'customer', label: 'Customer', kind: 'text' },
    { key: 'totalAmount', label: 'Total Amount', kind: 'money' },
    { key: 'totalProfit', label: 'Profit', kind: 'money' },
    { key: 'paymentStatus', label: 'Payment Status', kind: 'status' },
    { key: 'soldAt', label: 'Date', kind: 'datetime' },
  ],
  profit: [
    { key: 'invoiceNumber', label: 'Invoice', kind: 'text' },
    { key: 'customer', label: 'Customer', kind: 'text' },
    { key: 'totalAmount', label: 'Revenue', kind: 'money' },
    { key: 'totalProfit', label: 'Profit', kind: 'money' },
    { key: 'paymentStatus', label: 'Payment Status', kind: 'status' },
    { key: 'soldAt', label: 'Date', kind: 'datetime' },
  ],
  expenses: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' },
    { key: 'amount', label: 'Amount', kind: 'money' },
    { key: 'paymentMethod', label: 'Payment Method', kind: 'method' },
    { key: 'expenseDate', label: 'Date', kind: 'datetime' },
  ],
  inventory: [
    { key: 'sku', label: 'SKU', kind: 'text' },
    { key: 'name', label: 'Product', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' },
    { key: 'stockQuantity', label: 'Stock', kind: 'number' },
    { key: 'reorderLevel', label: 'Reorder Level', kind: 'number' },
    { key: 'costPrice', label: 'Cost', kind: 'money' },
    { key: 'sellingPrice', label: 'Selling Price', kind: 'money' },
    { key: 'stockValue', label: 'Stock Value', kind: 'money' },
    { key: 'stockStatus', label: 'Status', kind: 'status' },
  ],
  debts: [
    { key: 'name', label: 'Customer', kind: 'text' },
    { key: 'phone', label: 'Phone', kind: 'text' },
    { key: 'outstandingBalance', label: 'Outstanding', kind: 'money' },
    { key: 'totalPurchases', label: 'Total Purchases', kind: 'money' },
    { key: 'totalPaid', label: 'Total Paid', kind: 'money' },
  ],
  payments: [
    { key: 'invoice', label: 'Invoice', kind: 'text' },
    { key: 'customer', label: 'Customer', kind: 'text' },
    { key: 'amount', label: 'Amount', kind: 'money' },
    { key: 'method', label: 'Method', kind: 'method' },
    { key: 'paidAt', label: 'Date', kind: 'datetime' },
  ],
  purchases: [
    { key: 'reference', label: 'Reference', kind: 'text' },
    { key: 'supplier', label: 'Supplier', kind: 'text' },
    { key: 'totalAmount', label: 'Total Amount', kind: 'money' },
    { key: 'amountPaid', label: 'Amount Paid', kind: 'money' },
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'paymentStatus', label: 'Payment Status', kind: 'status' },
    { key: 'purchaseDate', label: 'Date', kind: 'datetime' },
  ],
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  RECEIVED: 'Received',
  ORDERED: 'Ordered',
  DRAFT: 'Draft',
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
};

export function formatReportStatus(value: unknown): string {
  if (value == null || value === '') return '—';
  const raw = String(value);
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatReportMethod(value: unknown): string {
  if (value == null || value === '') return '—';
  return paymentMethodLabel(String(value));
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function partsInBusinessTz(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return bag;
}

/** Human date: 24 Sep 2026 */
export function formatReportDate(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const p = partsInBusinessTz(d);
  const month = MONTHS[Number(p.month) - 1] ?? p.month;
  return `${p.day} ${month} ${p.year}`;
}

/** Human datetime: 24 Sep 2026, 4:26 PM */
export function formatReportDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const p = partsInBusinessTz(d);
  const month = MONTHS[Number(p.month) - 1] ?? p.month;
  const hour = p.hour;
  const minute = p.minute?.padStart(2, '0') ?? '00';
  const dayPeriod = (p.dayPeriod ?? '').toUpperCase();
  return `${p.day} ${month} ${p.year}, ${hour}:${minute} ${dayPeriod}`.trim();
}

export function formatReportCell(kind: ReportColumnKind, value: unknown): string {
  switch (kind) {
    case 'money':
      return formatTzs(value as string | number);
    case 'date':
      return formatReportDate(value);
    case 'datetime':
      return formatReportDateTime(value);
    case 'status':
      return formatReportStatus(value);
    case 'method':
      return formatReportMethod(value);
    case 'number':
      if (value == null || value === '') return '—';
      return String(value);
    case 'text':
    default:
      if (value == null || value === '') return '—';
      return String(value);
  }
}

export function paymentStatusBadgeClass(status: unknown): string {
  const s = String(status ?? '');
  if (s === 'PAID') return 'bg-emerald-50/90 text-emerald-700 border-emerald-100/80';
  if (s === 'PARTIAL') return 'bg-amber-50/90 text-amber-700 border-amber-100/80';
  if (s === 'PENDING') return 'bg-slate-100/90 text-slate-600 border-slate-200/80';
  if (s === 'IN_STOCK') return 'bg-emerald-50/90 text-emerald-700 border-emerald-100/80';
  if (s === 'LOW_STOCK') return 'bg-amber-50/90 text-amber-700 border-amber-100/80';
  if (s === 'OUT_OF_STOCK') return 'bg-rose-50/90 text-rose-600 border-rose-100/80';
  return 'bg-slate-100/90 text-slate-600 border-slate-200/80';
}

export function formatReportPeriodLabel(opts: {
  tab: ReportKey;
  preset: DateRangePreset;
  label: string;
  from?: string;
  to?: string;
}): string {
  if (opts.tab === 'inventory') return 'Current stock';
  if (opts.tab === 'debts') return 'Current outstanding';

  if (opts.preset === 'custom' && opts.from && opts.to) {
    return `${formatReportDate(opts.from)} – ${formatReportDate(opts.to)}`;
  }
  return opts.label;
}

export type ReportSummaryItem = { label: string; value: string };

export function buildReportSummaries(data: {
  total?: string;
  revenue?: string;
  grossProfit?: string;
  totalProfit?: string;
  amountCollected?: string;
  costOfGoodsSold?: string;
  creditSales?: string;
  count?: number;
}): ReportSummaryItem[] {
  const items: ReportSummaryItem[] = [];
  if (data.total !== undefined) items.push({ label: 'Total', value: formatTzs(data.total) });
  if (data.revenue !== undefined) items.push({ label: 'Revenue', value: formatTzs(data.revenue) });
  if (data.costOfGoodsSold !== undefined) {
    items.push({ label: 'Cost of Goods Sold', value: formatTzs(data.costOfGoodsSold) });
  }
  if (data.grossProfit !== undefined) {
    items.push({ label: 'Gross Profit', value: formatTzs(data.grossProfit) });
  } else if (data.totalProfit !== undefined) {
    items.push({ label: 'Total Profit', value: formatTzs(data.totalProfit) });
  }
  if (data.amountCollected !== undefined) {
    items.push({ label: 'Amount Collected', value: formatTzs(data.amountCollected) });
  }
  if (data.creditSales !== undefined) {
    items.push({ label: 'Credit Sales', value: formatTzs(data.creditSales) });
  }
  if (data.count !== undefined) {
    items.push({ label: 'Records', value: String(data.count) });
  }
  return items;
}
