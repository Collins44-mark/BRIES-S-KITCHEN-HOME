import { createClient } from '@/lib/supabase/client';
import type {
  DashboardSummary,
  DateRangePreset,
  PaymentMethodSummary,
  TopDebtor,
  TopSellingProduct,
} from '@bries/types';
import { resolveSoldAtRange } from '@/lib/supabase/sales-history';

type MoneyCents = number;

type SaleItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  base_quantity: number | null;
  line_total: string | number;
  line_profit: string | number;
};

type SaleAggRow = {
  total_amount: string | number;
  total_profit: string | number;
  amount_due: string | number;
  items?: SaleItemRow[] | null;
};

type PaymentRow = {
  amount: string | number;
  method: 'CASH' | 'MPESA' | 'BANK' | 'CREDIT';
};

type DebtAccountRow = {
  customer_id: string;
  outstanding_balance: string | number;
  customer: { id: string; name: string } | null;
};

function mapDashboardError(message: string): Error {
  const raw = message || 'Unable to load dashboard.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view the dashboard.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to view the dashboard.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[dashboard]', raw);
    return new Error('Unable to load dashboard. Please try again.');
  }
  return new Error(raw);
}

/** Parse stored money to integer cents (avoids float drift). */
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

function percentChange(current: MoneyCents, previous: MoneyCents): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function percentOf(part: MoneyCents, whole: MoneyCents): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/** Physical base qty for dashboard metrics (pre- and post-multi-unit rows). */
function itemBaseQuantity(item: SaleItemRow): number {
  if (item.base_quantity != null && Number.isFinite(Number(item.base_quantity))) {
    return Number(item.base_quantity);
  }
  return Number(item.quantity) || 0;
}

/**
 * Previous comparable window for change % hints (mirrors Nest resolveDateRange).
 */
function resolveDashboardRange(
  preset: DateRangePreset = 'today',
  from?: string,
  to?: string,
): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
  const range = resolveSoldAtRange(preset, from, to);

  if (preset === 'custom' && from && to) {
    const duration = range.to.getTime() - range.from.getTime();
    return {
      ...range,
      previousFrom: new Date(range.from.getTime() - duration - 1),
      previousTo: new Date(range.from.getTime() - 1),
    };
  }

  if (preset === 'yesterday') {
    const prev = new Date(range.from);
    prev.setDate(prev.getDate() - 1);
    const start = new Date(prev);
    start.setHours(0, 0, 0, 0);
    const end = new Date(prev);
    end.setHours(23, 59, 59, 999);
    return { ...range, previousFrom: start, previousTo: end };
  }

  if (preset === 'this_month') {
    const prevMonthEnd = new Date(range.from.getTime() - 1);
    const prevMonthStart = new Date(
      prevMonthEnd.getFullYear(),
      prevMonthEnd.getMonth(),
      1,
    );
    prevMonthStart.setHours(0, 0, 0, 0);
    const prevEnd = new Date(prevMonthEnd);
    prevEnd.setHours(23, 59, 59, 999);
    return { ...range, previousFrom: prevMonthStart, previousTo: prevEnd };
  }

  if (preset === 'this_week') {
    const duration = range.to.getTime() - range.from.getTime();
    return {
      ...range,
      previousFrom: new Date(range.from.getTime() - duration - 1),
      previousTo: new Date(range.from.getTime() - 1),
    };
  }

  // today → compare to yesterday
  const yesterday = new Date(range.from);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStart = new Date(yesterday);
  yStart.setHours(0, 0, 0, 0);
  const yEnd = new Date(yesterday);
  yEnd.setHours(23, 59, 59, 999);
  return { ...range, previousFrom: yStart, previousTo: yEnd };
}

function emptySummary(): DashboardSummary {
  return {
    totalSales: '0.00',
    totalProfit: '0.00',
    amountCollected: '0.00',
    creditSales: '0.00',
    salesChangePercent: null,
    profitChangePercent: null,
    collectedPercentOfSales: 0,
    creditPercentOfSales: 0,
    totalProducts: 0,
    categoryCount: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    outstandingDebts: '0.00',
    debtorsCount: 0,
    expensesTotal: '0.00',
    expensesCount: 0,
    itemsSold: 0,
    topSellingProducts: [],
    stockStatus: {
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      totalStockValue: '0.00',
    },
    paymentMethods: [],
    expensesSummary: {
      totalExpenses: '0.00',
      purchasesStock: '0.00',
      otherExpenses: '0.00',
    },
    topDebtors: [],
  };
}

/**
 * Read-only dashboard summary from Supabase.
 *
 * Aggregation approach: date/status-filtered row sets are loaded via PostgREST,
 * then totals are summed in cents on the client (no RPC / no Nest). Datasets
 * stay bounded by the selected sold_at / paid_at window.
 */
export async function getDashboardSummary(
  preset: DateRangePreset = 'today',
  from?: string,
  to?: string,
): Promise<DashboardSummary> {
  const supabase = createClient();
  const range = resolveDashboardRange(preset, from, to);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const prevFromIso = range.previousFrom.toISOString();
  const prevToIso = range.previousTo.toISOString();

  const [salesResult, previousSalesResult, paymentsResult, debtsResult] =
    await Promise.all([
      // COMPLETED sales in range + nested sale_items (top products).
      supabase
        .from('sales')
        .select(
          `
          total_amount,
          total_profit,
          amount_due,
          items:sale_items (
            product_id,
            product_name,
            quantity,
            base_quantity,
            line_total,
            line_profit
          )
        `,
        )
        .eq('status', 'COMPLETED')
        .gte('sold_at', fromIso)
        .lte('sold_at', toIso),
      supabase
        .from('sales')
        .select('total_amount, total_profit')
        .eq('status', 'COMPLETED')
        .gte('sold_at', prevFromIso)
        .lte('sold_at', prevToIso),
      // Actual payment rows only; CREDIT excluded.
      supabase
        .from('payments')
        .select('amount, method')
        .neq('method', 'CREDIT')
        .gte('paid_at', fromIso)
        .lte('paid_at', toIso),
      // Current balances — not date-filtered.
      supabase
        .from('customer_accounts')
        .select(
          `
          customer_id,
          outstanding_balance,
          customer:customers ( id, name )
        `,
        )
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false }),
    ]);

  for (const result of [salesResult, previousSalesResult, paymentsResult, debtsResult]) {
    if (result.error) throw mapDashboardError(result.error.message);
  }

  const sales = (salesResult.data ?? []) as unknown as SaleAggRow[];
  const previousSales = (previousSalesResult.data ?? []) as SaleAggRow[];
  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const debtAccounts = (debtsResult.data ?? []) as unknown as DebtAccountRow[];

  let totalSalesCents = 0;
  let totalProfitCents = 0;
  let creditSalesCents = 0;
  for (const sale of sales) {
    totalSalesCents += toCents(sale.total_amount);
    totalProfitCents += toCents(sale.total_profit);
    creditSalesCents += toCents(sale.amount_due);
  }

  let previousSalesCents = 0;
  let previousProfitCents = 0;
  for (const sale of previousSales) {
    previousSalesCents += toCents(sale.total_amount);
    previousProfitCents += toCents(sale.total_profit);
  }

  // Amount Collected = Total Sales − Credit Sales (amount_due), not sum of payments.
  const amountCollectedCents = totalSalesCents - creditSalesCents;

  const productAgg = new Map<
    string,
    { productId: string; productName: string; qty: number; revenue: MoneyCents; profit: MoneyCents }
  >();
  let itemsSold = 0;
  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      // Physical base units (COALESCE(base_quantity, quantity)) — not mixed selling units.
      const baseQty =
        item.base_quantity != null && Number.isFinite(Number(item.base_quantity))
          ? Number(item.base_quantity)
          : item.quantity;
      itemsSold += baseQty;
      const existing = productAgg.get(item.product_id) ?? {
        productId: item.product_id,
        productName: item.product_name,
        qty: 0,
        revenue: 0,
        profit: 0,
      };
      existing.qty += baseQty;
      existing.revenue += toCents(item.line_total);
      existing.profit += toCents(item.line_profit);
      productAgg.set(item.product_id, existing);
    }
  }

  const topSellingProducts: TopSellingProduct[] = Array.from(productAgg.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map((p, index) => ({
      rank: index + 1,
      productId: p.productId,
      productName: p.productName,
      quantitySold: p.qty,
      revenue: fromCents(p.revenue),
      profit: fromCents(p.profit),
    }));

  // Payment methods: real payment rows only (CASH / MPESA / BANK). Never CREDIT.
  const methodCents: Record<'CASH' | 'MPESA' | 'BANK', MoneyCents> = {
    CASH: 0,
    MPESA: 0,
    BANK: 0,
  };
  for (const payment of payments) {
    if (payment.method === 'CASH' || payment.method === 'MPESA' || payment.method === 'BANK') {
      methodCents[payment.method] += toCents(payment.amount);
    }
  }
  const methodSum =
    methodCents.CASH + methodCents.MPESA + methodCents.BANK;
  const paymentMethods: PaymentMethodSummary[] =
    methodSum <= 0
      ? []
      : (['CASH', 'MPESA', 'BANK'] as const).map((method) => ({
          method,
          amount: fromCents(methodCents[method]),
          percent: percentOf(methodCents[method], methodSum),
        }));

  let outstandingDebtsCents = 0;
  const topDebtors: TopDebtor[] = debtAccounts.slice(0, 5).map((a, index) => {
    outstandingDebtsCents += toCents(a.outstanding_balance);
    return {
      rank: index + 1,
      customerId: a.customer_id,
      name: a.customer?.name ?? '—',
      outstandingBalance: fromCents(toCents(a.outstanding_balance)),
    };
  });
  // Include balances beyond top-5 in the outstanding total.
  for (let i = 5; i < debtAccounts.length; i += 1) {
    outstandingDebtsCents += toCents(debtAccounts[i].outstanding_balance);
  }

  // Empty DB → zeros / empty lists (not an error).
  if (
    sales.length === 0 &&
    previousSales.length === 0 &&
    payments.length === 0 &&
    debtAccounts.length === 0
  ) {
    return emptySummary();
  }

  return {
    ...emptySummary(),
    totalSales: fromCents(totalSalesCents),
    totalProfit: fromCents(totalProfitCents),
    amountCollected: fromCents(amountCollectedCents),
    creditSales: fromCents(creditSalesCents),
    salesChangePercent: percentChange(totalSalesCents, previousSalesCents),
    profitChangePercent: percentChange(totalProfitCents, previousProfitCents),
    collectedPercentOfSales: percentOf(amountCollectedCents, totalSalesCents),
    creditPercentOfSales: percentOf(creditSalesCents, totalSalesCents),
    outstandingDebts: fromCents(outstandingDebtsCents),
    debtorsCount: debtAccounts.length,
    itemsSold,
    topSellingProducts,
    paymentMethods,
    topDebtors,
  };
}
