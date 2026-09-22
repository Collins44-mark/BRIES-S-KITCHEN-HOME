import { createClient } from '@/lib/supabase/client';
import type { DateRangePreset } from '@bries/types';
import { resolveSoldAtRange } from '@/lib/supabase/sales-history';

type MoneyCents = number;

export type ReportRow = Record<string, unknown>;

export type BaseReport = {
  from?: string;
  to?: string;
  total?: string;
  count?: number;
  rows: ReportRow[];
};

export type SalesReport = BaseReport & {
  total: string;
  count: number;
  /** Sum of sales.total_profit — same definition as Dashboard Total Profit. */
  totalProfit: string;
  /** Total Sales − credit (amount_due) — same as Dashboard Amount Collected. */
  amountCollected: string;
  creditSales: string;
};

export type ProfitReport = SalesReport & {
  revenue: string;
  costOfGoodsSold: string;
  /**
   * Gross profit from stored sales.total_profit (COMPLETED only).
   * Matches Dashboard Total Profit for the same date range.
   * (Not recomputed as revenue − expenses.)
   */
  grossProfit: string;
};

export type ExpensesReport = BaseReport & { total: string };
export type InventoryReport = { rows: ReportRow[] };
export type DebtsReport = BaseReport & { total: string };
export type PaymentsReport = BaseReport & { total: string };
export type PurchasesReport = BaseReport & { total: string };

export type ReportDateFilters = {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
};

function mapReportError(message: string): Error {
  const raw = message || 'Unable to load report.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view reports.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to view reports.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[reports]', raw);
    return new Error('Unable to load report. Please try again.');
  }
  return new Error(raw);
}

/** Parse stored money to integer cents (same approach as dashboard.ts). */
function toCents(value: string | number | null | undefined): MoneyCents {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const negative = raw.startsWith('-');
  const normalized = negative ? raw.slice(1) : raw;
  const [wholePart, fracPart = ''] = normalized.split('.');
  const whole = Number.parseInt(wholePart || '0', 10);
  if (!Number.isFinite(whole)) return 0;
  const frac = `${fracPart}00`.slice(0, 2);
  const cents = whole * 100 + Number.parseInt(frac, 10);
  return negative ? -cents : cents;
}

function fromCents(cents: MoneyCents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

function moneyString(value: string | number | null | undefined): string {
  return fromCents(toCents(value));
}

type SaleRow = {
  id: string;
  invoice_number: string;
  total_amount: string | number;
  total_profit: string | number;
  total_cost: string | number;
  amount_due: string | number;
  payment_status: string;
  sold_at: string;
  customer: { name: string; phone: string | null } | null;
};

/**
 * Sales report — COMPLETED sales in sold_at range.
 * Totals align with Dashboard: Total Sales / Total Profit / Amount Collected.
 */
export async function getSalesReport(
  filters: ReportDateFilters = {},
): Promise<SalesReport> {
  const supabase = createClient();
  const range = resolveSoldAtRange(filters.preset ?? 'today', filters.from, filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await supabase
    .from('sales')
    .select(
      `
      id,
      invoice_number,
      total_amount,
      total_profit,
      total_cost,
      amount_due,
      payment_status,
      sold_at,
      customer:customers ( name, phone )
    `,
    )
    .eq('status', 'COMPLETED')
    .gte('sold_at', fromIso)
    .lte('sold_at', toIso)
    .order('sold_at', { ascending: false });

  if (error) throw mapReportError(error.message);

  const sales = (data ?? []) as unknown as SaleRow[];
  let totalCents = 0;
  let profitCents = 0;
  let creditCents = 0;

  const rows: ReportRow[] = sales.map((s) => {
    totalCents += toCents(s.total_amount);
    profitCents += toCents(s.total_profit);
    creditCents += toCents(s.amount_due);
    return {
      id: s.id,
      invoiceNumber: s.invoice_number,
      customer: s.customer?.name ?? 'Walk-in',
      totalAmount: moneyString(s.total_amount),
      totalProfit: moneyString(s.total_profit),
      paymentStatus: s.payment_status,
      soldAt: s.sold_at,
    };
  });

  const amountCollectedCents = totalCents - creditCents;

  return {
    from: fromIso,
    to: toIso,
    total: fromCents(totalCents),
    count: sales.length,
    totalProfit: fromCents(profitCents),
    amountCollected: fromCents(amountCollectedCents),
    creditSales: fromCents(creditCents),
    rows,
  };
}

/**
 * Profit report — revenue / COGS from sales; grossProfit = sum(total_profit).
 * Matches Dashboard Total Profit (stored total_profit, not expenses-adjusted).
 */
export async function getProfitReport(
  filters: ReportDateFilters = {},
): Promise<ProfitReport> {
  const supabase = createClient();
  const range = resolveSoldAtRange(filters.preset ?? 'today', filters.from, filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await supabase
    .from('sales')
    .select(
      `
      id,
      invoice_number,
      total_amount,
      total_profit,
      total_cost,
      amount_due,
      payment_status,
      sold_at,
      customer:customers ( name, phone )
    `,
    )
    .eq('status', 'COMPLETED')
    .gte('sold_at', fromIso)
    .lte('sold_at', toIso)
    .order('sold_at', { ascending: false });

  if (error) throw mapReportError(error.message);

  const sales = (data ?? []) as unknown as SaleRow[];
  let totalCents = 0;
  let profitCents = 0;
  let creditCents = 0;
  let cogsCents = 0;

  const rows: ReportRow[] = sales.map((s) => {
    totalCents += toCents(s.total_amount);
    profitCents += toCents(s.total_profit);
    creditCents += toCents(s.amount_due);
    cogsCents += toCents(s.total_cost);
    return {
      id: s.id,
      invoiceNumber: s.invoice_number,
      customer: s.customer?.name ?? 'Walk-in',
      totalAmount: moneyString(s.total_amount),
      totalProfit: moneyString(s.total_profit),
      paymentStatus: s.payment_status,
      soldAt: s.sold_at,
    };
  });

  return {
    from: fromIso,
    to: toIso,
    total: fromCents(totalCents),
    count: sales.length,
    totalProfit: fromCents(profitCents),
    amountCollected: fromCents(totalCents - creditCents),
    creditSales: fromCents(creditCents),
    revenue: fromCents(totalCents),
    costOfGoodsSold: fromCents(cogsCents),
    grossProfit: fromCents(profitCents),
    rows,
  };
}

/**
 * Expenses report — expense_date in range.
 */
export async function getExpensesReport(
  filters: ReportDateFilters = {},
): Promise<ExpensesReport> {
  const supabase = createClient();
  const range = resolveSoldAtRange(filters.preset ?? 'today', filters.from, filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await supabase
    .from('expenses')
    .select('id, title, category, amount, payment_method, expense_date')
    .gte('expense_date', fromIso)
    .lte('expense_date', toIso)
    .order('expense_date', { ascending: false });

  if (error) throw mapReportError(error.message);

  let totalCents = 0;
  const rows: ReportRow[] = (data ?? []).map((e) => {
    totalCents += toCents(e.amount);
    return {
      id: e.id,
      title: e.title,
      category: e.category,
      amount: moneyString(e.amount),
      paymentMethod: e.payment_method,
      expenseDate: e.expense_date,
    };
  });

  return { from: fromIso, to: toIso, total: fromCents(totalCents), rows };
}

/**
 * Inventory report — current stock from products.stock_quantity (not movements).
 * Not date-filtered (point-in-time stock).
 */
export async function getInventoryReport(): Promise<InventoryReport> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      sku,
      name,
      stock_quantity,
      reorder_level,
      cost_price,
      selling_price,
      category:categories ( name )
    `,
    )
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });

  if (error) throw mapReportError(error.message);

  const rows: ReportRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    sku: string;
    name: string;
    stock_quantity: number;
    reorder_level: number;
    cost_price: string | number;
    selling_price: string | number;
    category: { name: string } | null;
  }>).map((p) => {
    const qty = p.stock_quantity;
    const stockStatus =
      qty <= 0 ? 'OUT_OF_STOCK' : qty <= p.reorder_level ? 'LOW_STOCK' : 'IN_STOCK';
    const stockValueCents = toCents(p.cost_price) * qty;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? '—',
      stockQuantity: qty,
      reorderLevel: p.reorder_level,
      costPrice: moneyString(p.cost_price),
      sellingPrice: moneyString(p.selling_price),
      stockValue: fromCents(stockValueCents),
      stockStatus,
    };
  });

  return { rows };
}

/**
 * Debts report — current outstanding balances (not sales-date filtered).
 */
export async function getDebtsReport(): Promise<DebtsReport> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('customer_accounts')
    .select(
      `
      customer_id,
      outstanding_balance,
      total_purchases,
      total_paid,
      customer:customers ( name, phone )
    `,
    )
    .gt('outstanding_balance', 0)
    .order('outstanding_balance', { ascending: false });

  if (error) throw mapReportError(error.message);

  let totalCents = 0;
  const rows: ReportRow[] = ((data ?? []) as unknown as Array<{
    customer_id: string;
    outstanding_balance: string | number;
    total_purchases: string | number;
    total_paid: string | number;
    customer: { name: string; phone: string | null } | null;
  }>).map((a) => {
    totalCents += toCents(a.outstanding_balance);
    return {
      customerId: a.customer_id,
      name: a.customer?.name ?? '—',
      phone: a.customer?.phone ?? null,
      outstandingBalance: moneyString(a.outstanding_balance),
      totalPurchases: moneyString(a.total_purchases),
      totalPaid: moneyString(a.total_paid),
    };
  });

  return { total: fromCents(totalCents), rows };
}

/**
 * Payments report — actual payment rows by paid_at.
 * Excludes CREDIT (same rule as Dashboard payment methods).
 */
export async function getPaymentsReport(
  filters: ReportDateFilters = {},
): Promise<PaymentsReport> {
  const supabase = createClient();
  const range = resolveSoldAtRange(filters.preset ?? 'today', filters.from, filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await supabase
    .from('payments')
    .select(
      `
      id,
      amount,
      method,
      paid_at,
      customer:customers ( name ),
      sale:sales ( invoice_number )
    `,
    )
    .neq('method', 'CREDIT')
    .gte('paid_at', fromIso)
    .lte('paid_at', toIso)
    .order('paid_at', { ascending: false });

  if (error) throw mapReportError(error.message);

  let totalCents = 0;
  const rows: ReportRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    amount: string | number;
    method: string;
    paid_at: string;
    customer: { name: string } | null;
    sale: { invoice_number: string } | null;
  }>).map((p) => {
    totalCents += toCents(p.amount);
    return {
      id: p.id,
      amount: moneyString(p.amount),
      method: p.method,
      customer: p.customer?.name ?? null,
      invoice: p.sale?.invoice_number ?? null,
      paidAt: p.paid_at,
    };
  });

  return { total: fromCents(totalCents), rows };
}

/**
 * Purchases report — purchase_date in range (not sales revenue).
 */
export async function getPurchasesReport(
  filters: ReportDateFilters = {},
): Promise<PurchasesReport> {
  const supabase = createClient();
  const range = resolveSoldAtRange(filters.preset ?? 'today', filters.from, filters.to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      id,
      reference,
      total_amount,
      amount_paid,
      status,
      payment_status,
      purchase_date,
      supplier:suppliers ( name )
    `,
    )
    .gte('purchase_date', fromIso)
    .lte('purchase_date', toIso)
    .order('purchase_date', { ascending: false });

  if (error) throw mapReportError(error.message);

  let totalCents = 0;
  const rows: ReportRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    reference: string;
    total_amount: string | number;
    amount_paid: string | number;
    status: string;
    payment_status: string;
    purchase_date: string;
    supplier: { name: string } | null;
  }>).map((p) => {
    totalCents += toCents(p.total_amount);
    return {
      id: p.id,
      reference: p.reference,
      supplier: p.supplier?.name ?? '—',
      totalAmount: moneyString(p.total_amount),
      amountPaid: moneyString(p.amount_paid),
      status: p.status,
      paymentStatus: p.payment_status,
      purchaseDate: p.purchase_date,
    };
  });

  return { total: fromCents(totalCents), rows };
}
