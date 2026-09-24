import { formatTzs } from '@/lib/utils';
import { paymentMethodLabel } from '@/lib/receipt/types';
import { paymentMethodKey, statusKey } from '@/lib/i18n/dictionaries';
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

export type ReportTranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export type ReportColumn = {
  key: string;
  labelKey: string;
  kind: ReportColumnKind;
};

export const REPORT_TITLE_KEYS: Record<ReportKey, string> = {
  sales: 'reports.salesTitle',
  profit: 'reports.profitTitle',
  expenses: 'reports.expensesTitle',
  inventory: 'reports.inventoryTitle',
  debts: 'reports.debtsTitle',
  payments: 'reports.paymentsTitle',
  purchases: 'reports.purchasesTitle',
};

/** Visible columns only — internal ids (UUID) are never included. */
export const REPORT_COLUMNS: Record<ReportKey, ReportColumn[]> = {
  sales: [
    { key: 'invoiceNumber', labelKey: 'common.invoice', kind: 'text' },
    { key: 'customer', labelKey: 'common.customer', kind: 'text' },
    { key: 'totalAmount', labelKey: 'common.total', kind: 'money' },
    { key: 'totalProfit', labelKey: 'common.profit', kind: 'money' },
    { key: 'paymentStatus', labelKey: 'sales.paymentStatus', kind: 'status' },
    { key: 'soldAt', labelKey: 'common.date', kind: 'datetime' },
  ],
  profit: [
    { key: 'invoiceNumber', labelKey: 'common.invoice', kind: 'text' },
    { key: 'customer', labelKey: 'common.customer', kind: 'text' },
    { key: 'totalAmount', labelKey: 'reports.revenue', kind: 'money' },
    { key: 'totalProfit', labelKey: 'common.profit', kind: 'money' },
    { key: 'paymentStatus', labelKey: 'sales.paymentStatus', kind: 'status' },
    { key: 'soldAt', labelKey: 'common.date', kind: 'datetime' },
  ],
  expenses: [
    { key: 'title', labelKey: 'expenses.titleField', kind: 'text' },
    { key: 'category', labelKey: 'common.category', kind: 'text' },
    { key: 'amount', labelKey: 'common.amount', kind: 'money' },
    { key: 'paymentMethod', labelKey: 'pos.paymentMethod', kind: 'method' },
    { key: 'expenseDate', labelKey: 'common.date', kind: 'datetime' },
  ],
  inventory: [
    { key: 'sku', labelKey: 'products.sku', kind: 'text' },
    { key: 'name', labelKey: 'products.product', kind: 'text' },
    { key: 'category', labelKey: 'common.category', kind: 'text' },
    { key: 'stockQuantity', labelKey: 'products.stock', kind: 'number' },
    { key: 'reorderLevel', labelKey: 'products.reorderLevel', kind: 'number' },
    { key: 'costPrice', labelKey: 'products.cost', kind: 'money' },
    { key: 'sellingPrice', labelKey: 'products.sellingPrice', kind: 'money' },
    { key: 'stockValue', labelKey: 'inventory.stockValue', kind: 'money' },
    { key: 'stockStatus', labelKey: 'common.status', kind: 'status' },
  ],
  debts: [
    { key: 'name', labelKey: 'common.customer', kind: 'text' },
    { key: 'phone', labelKey: 'common.phone', kind: 'text' },
    { key: 'outstandingBalance', labelKey: 'debts.outstanding', kind: 'money' },
    { key: 'totalPurchases', labelKey: 'customers.purchases', kind: 'money' },
    { key: 'totalPaid', labelKey: 'customers.paid', kind: 'money' },
  ],
  payments: [
    { key: 'invoice', labelKey: 'common.invoice', kind: 'text' },
    { key: 'customer', labelKey: 'common.customer', kind: 'text' },
    { key: 'amount', labelKey: 'common.amount', kind: 'money' },
    { key: 'method', labelKey: 'common.method', kind: 'method' },
    { key: 'paidAt', labelKey: 'common.date', kind: 'datetime' },
  ],
  purchases: [
    { key: 'reference', labelKey: 'common.reference', kind: 'text' },
    { key: 'supplier', labelKey: 'common.supplier', kind: 'text' },
    { key: 'totalAmount', labelKey: 'common.total', kind: 'money' },
    { key: 'amountPaid', labelKey: 'purchases.amountPaid', kind: 'money' },
    { key: 'status', labelKey: 'common.status', kind: 'status' },
    { key: 'paymentStatus', labelKey: 'sales.paymentStatus', kind: 'status' },
    { key: 'purchaseDate', labelKey: 'common.date', kind: 'datetime' },
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

export function formatReportStatus(value: unknown, t?: ReportTranslateFn): string {
  if (value == null || value === '') return '—';
  const raw = String(value);
  if (t) {
    const key = statusKey(raw);
    if (key) return t(key);
  }
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatReportMethod(value: unknown, t?: ReportTranslateFn): string {
  if (value == null || value === '') return '—';
  const raw = String(value);
  if (t) {
    const key = paymentMethodKey(raw);
    if (key.startsWith('common.')) return t(key);
  }
  return paymentMethodLabel(raw);
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

export function formatReportCell(
  kind: ReportColumnKind,
  value: unknown,
  t?: ReportTranslateFn,
): string {
  switch (kind) {
    case 'money':
      return formatTzs(value as string | number);
    case 'date':
      return formatReportDate(value);
    case 'datetime':
      return formatReportDateTime(value);
    case 'status':
      return formatReportStatus(value, t);
    case 'method':
      return formatReportMethod(value, t);
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
  t?: ReportTranslateFn;
}): string {
  if (opts.tab === 'inventory') {
    return opts.t ? opts.t('reports.periodCurrentStock') : 'Current stock';
  }
  if (opts.tab === 'debts') {
    return opts.t ? opts.t('reports.periodCurrentOutstanding') : 'Current outstanding';
  }

  if (opts.preset === 'custom' && opts.from && opts.to) {
    return `${formatReportDate(opts.from)} – ${formatReportDate(opts.to)}`;
  }
  return opts.label;
}

export type ReportSummaryItem = { label: string; value: string };

export function buildReportSummaries(
  data: {
    total?: string;
    revenue?: string;
    grossProfit?: string;
    totalProfit?: string;
    amountCollected?: string;
    costOfGoodsSold?: string;
    creditSales?: string;
    count?: number;
  },
  t?: ReportTranslateFn,
): ReportSummaryItem[] {
  const label = (key: string, fallback: string) => (t ? t(key) : fallback);
  const items: ReportSummaryItem[] = [];
  if (data.total !== undefined) {
    items.push({ label: label('common.total', 'Total'), value: formatTzs(data.total) });
  }
  if (data.revenue !== undefined) {
    items.push({ label: label('reports.revenue', 'Revenue'), value: formatTzs(data.revenue) });
  }
  if (data.costOfGoodsSold !== undefined) {
    items.push({
      label: label('reports.costOfGoods', 'Cost of Goods Sold'),
      value: formatTzs(data.costOfGoodsSold),
    });
  }
  if (data.grossProfit !== undefined) {
    items.push({
      label: label('reports.grossProfit', 'Gross Profit'),
      value: formatTzs(data.grossProfit),
    });
  } else if (data.totalProfit !== undefined) {
    items.push({
      label: label('reports.totalProfit', 'Total Profit'),
      value: formatTzs(data.totalProfit),
    });
  }
  if (data.amountCollected !== undefined) {
    items.push({
      label: label('reports.amountCollected', 'Amount Collected'),
      value: formatTzs(data.amountCollected),
    });
  }
  if (data.creditSales !== undefined) {
    items.push({
      label: label('reports.creditSales', 'Credit Sales'),
      value: formatTzs(data.creditSales),
    });
  }
  if (data.count !== undefined) {
    items.push({ label: label('reports.records', 'Records'), value: String(data.count) });
  }
  return items;
}
