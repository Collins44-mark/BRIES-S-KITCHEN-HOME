import { createClient } from '@/lib/supabase/client';
import type { DateRangePreset } from '@bries/types';

export type SalePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
export type SaleDiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';
export type SalePaymentMethod = 'CASH' | 'MPESA' | 'BANK' | 'CREDIT';

export type SaleListItem = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  cashierId: string;
  cashierName: string;
  status: SaleStatus;
  subtotal: string;
  discountType: SaleDiscountType;
  discountValue: string;
  discountAmount: string;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: SalePaymentStatus;
  notes: string | null;
  soldAt: string;
};

export type SaleItemDetail = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
  lineSubtotal: string;
  discountAmount: string;
  lineTotal: string;
  lineCost: string;
  lineProfit: string;
  /** Snapshot at sale time; null for pre-multi-unit historical rows. */
  productUnitId: string | null;
  sellingUnitCode: string | null;
  sellingUnitLabel: string | null;
  conversionToBase: number | null;
  baseQuantity: number | null;
};

export type SalePaymentDetail = {
  id: string;
  amount: string;
  method: SalePaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
};

export type SaleDetail = SaleListItem & {
  items: SaleItemDetail[];
  payments: SalePaymentDetail[];
  /** Read-only from customer_accounts when customer_id is set. */
  customerOutstandingBalance: string | null;
  customerEmail: string | null;
};

export type ListSalesFilters = {
  /** Header date-range preset (Africa/local browser day boundaries). */
  preset?: DateRangePreset;
  from?: string;
  to?: string;
  /** Invoice number or customer name (ilike). */
  search?: string;
  paymentStatus?: SalePaymentStatus | 'ALL';
  /** Default 100 — matches legacy Nest findAll take. */
  limit?: number;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  cashier_id: string;
  status: SaleStatus;
  subtotal: string | number;
  discount_type: SaleDiscountType;
  discount_value: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  total_cost: string | number;
  total_profit: string | number;
  amount_paid: string | number;
  amount_due: string | number;
  payment_status: SalePaymentStatus;
  notes: string | null;
  sold_at: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
    account?:
      | { outstanding_balance: string | number }
      | { outstanding_balance: string | number }[]
      | null;
  } | null;
  cashier?: { id: string; first_name: string; last_name: string } | null;
};

type SaleItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string | number;
  unit_cost: string | number;
  line_subtotal: string | number;
  discount_amount: string | number;
  line_total: string | number;
  line_cost: string | number;
  line_profit: string | number;
  product_unit_id: string | null;
  selling_unit_code: string | null;
  selling_unit_label: string | null;
  conversion_to_base: number | null;
  base_quantity: number | null;
};

type SalePaymentRow = {
  id: string;
  amount: string | number;
  method: SalePaymentMethod;
  reference: string | null;
  notes: string | null;
  paid_at: string;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapSaleError(message: string): Error {
  const raw = message || 'Unable to load sales.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view sales.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to view sales.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[sales-history]', raw);
    return new Error('Unable to load sales. Please try again.');
  }
  return new Error(raw);
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

/** Resolves header date presets to sold_at bounds (same rules as legacy Nest date-range). */
export function resolveSoldAtRange(
  preset: DateRangePreset = 'today',
  from?: string,
  to?: string,
): { from: Date; to: Date } {
  const now = new Date();

  if (preset === 'custom' && from && to) {
    return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
  }
  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }
  if (preset === 'this_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { from: startOfDay(monday), to: endOfDay(now) };
  }
  if (preset === 'this_month') {
    return {
      from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: endOfDay(now),
    };
  }
  return { from: startOfDay(now), to: endOfDay(now) };
}

function cashierDisplayName(
  cashier: SaleRow['cashier'],
): string {
  if (!cashier) return '—';
  const name = `${cashier.first_name ?? ''} ${cashier.last_name ?? ''}`.trim();
  return name || '—';
}

/** Physical base units for metrics — works for pre- and post-multi-unit rows. */
export function saleItemBaseQuantity(item: {
  quantity: number;
  baseQuantity?: number | null;
}): number {
  if (item.baseQuantity != null && Number.isFinite(item.baseQuantity)) {
    return item.baseQuantity;
  }
  return item.quantity;
}

export type FormatSaleItemQuantityInput = {
  quantity: number;
  sellingUnitCode?: string | null;
  sellingUnitLabel?: string | null;
  baseQuantity?: number | null;
  /** Legacy products.unit when snapshot unit fields are null. */
  legacyUnit?: string | null;
};

/**
 * Display selling qty with unit snapshot. Never invents SET/PACK for legacy rows.
 */
export function formatSaleItemQuantity(item: FormatSaleItemQuantityInput): string {
  const qty = item.quantity;
  const label = item.sellingUnitLabel?.trim();
  const code = item.sellingUnitCode?.trim();
  if (label) return `${qty} ${label}`;
  if (code) return `${qty} ${code}`;
  const legacy = item.legacyUnit?.trim();
  if (legacy) return `${qty} ${legacy}`;
  return `${qty} base`;
}

/** Compact secondary line when base differs from selling qty or unit is multi. */
export function formatSaleItemBaseHint(item: FormatSaleItemQuantityInput): string | null {
  const base = saleItemBaseQuantity(item);
  const code = item.sellingUnitCode?.trim();
  const conversion =
    item.baseQuantity != null && item.quantity > 0
      ? Math.round(item.baseQuantity / item.quantity)
      : null;
  if (code && conversion != null && conversion > 1) {
    return `= ${base} base`;
  }
  if (code && item.baseQuantity != null && item.baseQuantity !== item.quantity) {
    return `= ${base} base`;
  }
  return null;
}

function toListItem(row: SaleRow): SaleListItem {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer?.name ?? null,
    customerPhone: row.customer?.phone ?? null,
    cashierId: row.cashier_id,
    cashierName: cashierDisplayName(row.cashier),
    status: row.status,
    subtotal: moneyString(row.subtotal),
    discountType: row.discount_type,
    discountValue: moneyString(row.discount_value),
    discountAmount: moneyString(row.discount_amount),
    totalAmount: moneyString(row.total_amount),
    totalCost: moneyString(row.total_cost),
    totalProfit: moneyString(row.total_profit),
    amountPaid: moneyString(row.amount_paid),
    amountDue: moneyString(row.amount_due),
    paymentStatus: row.payment_status,
    notes: row.notes,
    soldAt: row.sold_at,
  };
}

const SALE_LIST_SELECT = `
  id,
  invoice_number,
  customer_id,
  cashier_id,
  status,
  subtotal,
  discount_type,
  discount_value,
  discount_amount,
  total_amount,
  total_cost,
  total_profit,
  amount_paid,
  amount_due,
  payment_status,
  notes,
  sold_at,
  customer:customers ( id, name, phone ),
  cashier:profiles!sales_cashier_id_fkey ( id, first_name, last_name )
`;

/**
 * Read-only sales history list from public.sales.
 * Does not write sales, items, payments, stock, or customer accounts.
 */
export async function listSales(filters: ListSalesFilters = {}): Promise<SaleListItem[]> {
  const supabase = createClient();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

  let query = supabase
    .from('sales')
    .select(SALE_LIST_SELECT)
    .order('sold_at', { ascending: false })
    .limit(limit);

  if (filters.preset || filters.from || filters.to) {
    const range = resolveSoldAtRange(
      filters.preset ?? 'today',
      filters.from,
      filters.to,
    );
    query = query
      .gte('sold_at', range.from.toISOString())
      .lte('sold_at', range.to.toISOString());
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    query = query.eq('payment_status', filters.paymentStatus);
  }

  const { data, error } = await query;
  if (error) throw mapSaleError(error.message);

  let rows = ((data ?? []) as unknown as SaleRow[]).map(toListItem);

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(search) ||
        (r.customerName?.toLowerCase().includes(search) ?? false) ||
        (r.customerPhone?.toLowerCase().includes(search) ?? false) ||
        r.cashierName.toLowerCase().includes(search),
    );
  }

  return rows;
}

/**
 * Read-only sale detail: header + sale_items + payments + customer + cashier + account balance.
 * Does not write financial tables. Does not invent CREDIT payment rows for amount_due.
 */
export async function getSaleById(id: string): Promise<SaleDetail> {
  if (!id.trim()) throw new Error('Sale id is required.');

  const supabase = createClient();
  const { data, error } = await supabase
    .from('sales')
    .select(
      `
      id,
      invoice_number,
      customer_id,
      cashier_id,
      status,
      subtotal,
      discount_type,
      discount_value,
      discount_amount,
      total_amount,
      total_cost,
      total_profit,
      amount_paid,
      amount_due,
      payment_status,
      notes,
      sold_at,
      customer:customers (
        id,
        name,
        phone,
        email,
        account:customer_accounts (
          outstanding_balance
        )
      ),
      cashier:profiles!sales_cashier_id_fkey (
        id,
        first_name,
        last_name
      ),
      items:sale_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        unit_cost,
        line_subtotal,
        discount_amount,
        line_total,
        line_cost,
        line_profit,
        product_unit_id,
        selling_unit_code,
        selling_unit_label,
        conversion_to_base,
        base_quantity
      ),
      payments:payments (
        id,
        amount,
        method,
        reference,
        notes,
        paid_at
      )
    `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapSaleError(error.message);
  if (!data) throw new Error('Sale not found.');

  const row = data as unknown as SaleRow & {
    items?: SaleItemRow[] | null;
    payments?: SalePaymentRow[] | null;
  };

  const base = toListItem(row);

  const accountRaw = row.customer?.account;
  const account = Array.isArray(accountRaw) ? accountRaw[0] : accountRaw;
  const customerOutstandingBalance =
    row.customer_id && account
      ? moneyString(account.outstanding_balance)
      : row.customer_id
        ? '0'
        : null;

  const items = (row.items ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (item): SaleItemDetail => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: moneyString(item.unit_price),
        unitCost: moneyString(item.unit_cost),
        lineSubtotal: moneyString(item.line_subtotal),
        discountAmount: moneyString(item.discount_amount),
        lineTotal: moneyString(item.line_total),
        lineCost: moneyString(item.line_cost),
        lineProfit: moneyString(item.line_profit),
        productUnitId: item.product_unit_id ?? null,
        sellingUnitCode: item.selling_unit_code ?? null,
        sellingUnitLabel: item.selling_unit_label ?? null,
        conversionToBase:
          item.conversion_to_base == null ? null : Number(item.conversion_to_base),
        baseQuantity: item.base_quantity == null ? null : Number(item.base_quantity),
      }),
    );

  // Actual payment rows only — unpaid remainder is sales.amount_due, not a CREDIT line.
  const payments = (row.payments ?? [])
    .slice()
    .sort((a, b) => a.paid_at.localeCompare(b.paid_at) || a.id.localeCompare(b.id))
    .map(
      (p): SalePaymentDetail => ({
        id: p.id,
        amount: moneyString(p.amount),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        paidAt: p.paid_at,
      }),
    );

  return {
    ...base,
    customerEmail: row.customer?.email ?? null,
    customerOutstandingBalance,
    items,
    payments,
  };
}
