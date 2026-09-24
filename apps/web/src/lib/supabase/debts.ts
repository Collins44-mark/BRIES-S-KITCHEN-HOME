import { createClient } from '@/lib/supabase/client';

export type DebtorListItem = {
  rank: number;
  customerId: string;
  name: string;
  phone: string | null;
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
};

export type DebtsSummary = {
  totalOutstanding: string;
  debtorsCount: number;
  debtors: DebtorListItem[];
};

export type OutstandingSale = {
  id: string;
  invoiceNumber: string;
  soldAt: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
  status: string;
};

export type CustomerLedgerEntry = {
  id: string;
  type: 'SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
  amount: string;
  balanceAfter: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  saleId: string | null;
  paymentId: string | null;
};

export type CustomerDebtDetails = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
  outstandingSales: OutstandingSale[];
  transactions: CustomerLedgerEntry[];
};

export type ListDebtorsFilters = {
  search?: string;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapDebtError(message: string): Error {
  const raw = message || 'Unable to load debts.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view debts.');
  }
  if (/insufficient permissions|inactive staff|require_active_staff|42501/i.test(raw)) {
    return new Error('Your account cannot record debt payments. Contact an administrator.');
  }
  if (/row-level security|permission|policy/i.test(raw)) {
    return new Error('You do not have permission to view debts.');
  }
  if (/sale_id is required/i.test(raw)) {
    return new Error('Select a sale with an outstanding balance.');
  }
  if (/only allowed for completed sales/i.test(raw)) {
    return new Error('Debt payments are only allowed for completed sales.');
  }
  if (/customer_id is required/i.test(raw)) {
    return new Error('A customer is required.');
  }
  if (/customer not found or inactive/i.test(raw)) {
    return new Error('Customer not found or inactive.');
  }
  if (/sale not found/i.test(raw)) {
    return new Error('Sale not found.');
  }
  if (/sale does not belong/i.test(raw)) {
    return new Error('Sale does not belong to this customer.');
  }
  if (/exceeds sale remaining|exceeds sale/i.test(raw)) {
    return new Error('Payment amount exceeds the sale amount due.');
  }
  if (/exceeds customer outstanding/i.test(raw)) {
    return new Error('Payment amount exceeds the customer outstanding balance.');
  }
  if (/amount must be greater than 0/i.test(raw)) {
    return new Error('Payment amount must be greater than 0.');
  }
  if (/cannot record credit/i.test(raw)) {
    return new Error('CREDIT cannot be used for debt repayment.');
  }
  if (/payment method is required/i.test(raw)) {
    return new Error('Select a payment method.');
  }
  if (/invalid payment payload/i.test(raw)) {
    return new Error('Invalid payment data. Please try again.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[debts]', raw);
    return new Error('Unable to complete request. Please try again.');
  }
  return new Error(raw);
}

type AccountRow = {
  customer_id: string;
  total_purchases: string | number;
  total_paid: string | number;
  outstanding_balance: string | number;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
    is_active?: boolean;
  } | null;
};

/**
 * Read-only debtors with outstanding_balance > 0.
 * Uses customer_accounts.outstanding_balance as authoritative — no client recalc.
 */
export async function listDebtors(
  filters: ListDebtorsFilters = {},
): Promise<DebtsSummary> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('customer_accounts')
    .select(
      `
      customer_id,
      total_purchases,
      total_paid,
      outstanding_balance,
      customer:customers (
        id,
        name,
        phone,
        email,
        is_active
      )
    `,
    )
    .gt('outstanding_balance', 0)
    .order('outstanding_balance', { ascending: false });

  if (error) throw mapDebtError(error.message);

  let rows = (data ?? []) as unknown as AccountRow[];

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) => {
      const name = row.customer?.name?.toLowerCase() ?? '';
      const phone = row.customer?.phone?.toLowerCase() ?? '';
      return name.includes(search) || phone.includes(search);
    });
  }

  const debtors: DebtorListItem[] = rows.map((row, index) => ({
    rank: index + 1,
    customerId: row.customer_id,
    name: row.customer?.name ?? 'Unknown',
    phone: row.customer?.phone ?? null,
    totalPurchases: moneyString(row.total_purchases),
    totalPaid: moneyString(row.total_paid),
    outstandingBalance: moneyString(row.outstanding_balance),
  }));

  const totalOutstanding = debtors
    .reduce((sum, d) => sum + Number(d.outstandingBalance || 0), 0)
    .toFixed(2);

  return {
    totalOutstanding,
    debtorsCount: debtors.length,
    debtors,
  };
}

/**
 * Read-only customer debt detail:
 * account summary + sales with amount_due > 0 + customer_transactions ledger.
 * Does not call record_debt_payment or write any financial tables.
 */
export async function getCustomerDebtDetails(
  customerId: string,
): Promise<CustomerDebtDetails> {
  if (!customerId.trim()) throw new Error('Customer id is required.');

  const supabase = createClient();

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select(
      `
      id,
      name,
      phone,
      email,
      is_active,
      account:customer_accounts (
        total_purchases,
        total_paid,
        outstanding_balance
      )
    `,
    )
    .eq('id', customerId)
    .maybeSingle();

  if (customerError) throw mapDebtError(customerError.message);
  if (!customer) throw new Error('Customer not found.');

  const accountRaw = (
    customer as {
      account?:
        | {
            total_purchases: string | number;
            total_paid: string | number;
            outstanding_balance: string | number;
          }
        | {
            total_purchases: string | number;
            total_paid: string | number;
            outstanding_balance: string | number;
          }[]
        | null;
    }
  ).account;
  const account = Array.isArray(accountRaw) ? accountRaw[0] : accountRaw;

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select(
      `
      id,
      invoice_number,
      sold_at,
      total_amount,
      amount_paid,
      amount_due,
      payment_status,
      status
    `,
    )
    .eq('customer_id', customerId)
    .gt('amount_due', 0)
    .eq('status', 'COMPLETED')
    .order('sold_at', { ascending: false });

  if (salesError) throw mapDebtError(salesError.message);

  const { data: transactions, error: txError } = await supabase
    .from('customer_transactions')
    .select(
      `
      id,
      type,
      amount,
      balance_after,
      reference,
      notes,
      created_at,
      sale_id,
      payment_id
    `,
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (txError) throw mapDebtError(txError.message);

  const outstandingSales: OutstandingSale[] = (
    (sales ?? []) as Array<{
      id: string;
      invoice_number: string;
      sold_at: string;
      total_amount: string | number;
      amount_paid: string | number;
      amount_due: string | number;
      payment_status: string;
      status: string;
    }>
  ).map((s) => ({
    id: s.id,
    invoiceNumber: s.invoice_number,
    soldAt: s.sold_at,
    totalAmount: moneyString(s.total_amount),
    amountPaid: moneyString(s.amount_paid),
    amountDue: moneyString(s.amount_due),
    paymentStatus: s.payment_status,
    status: s.status,
  }));

  const ledger: CustomerLedgerEntry[] = (
    (transactions ?? []) as Array<{
      id: string;
      type: CustomerLedgerEntry['type'];
      amount: string | number;
      balance_after: string | number;
      reference: string | null;
      notes: string | null;
      created_at: string;
      sale_id: string | null;
      payment_id: string | null;
    }>
  ).map((t) => ({
    id: t.id,
    type: t.type,
    amount: moneyString(t.amount),
    balanceAfter: moneyString(t.balance_after),
    reference: t.reference,
    notes: t.notes,
    createdAt: t.created_at,
    saleId: t.sale_id,
    paymentId: t.payment_id,
  }));

  return {
    customerId: (customer as { id: string }).id,
    name: (customer as { name: string }).name,
    phone: (customer as { phone: string | null }).phone,
    email: (customer as { email: string | null }).email,
    isActive: Boolean((customer as { is_active: boolean }).is_active),
    totalPurchases: moneyString(account?.total_purchases),
    totalPaid: moneyString(account?.total_paid),
    outstandingBalance: moneyString(account?.outstanding_balance),
    outstandingSales,
    transactions: ledger,
  };
}

export type DebtPaymentMethod = 'CASH' | 'MPESA' | 'BANK';

/**
 * App-facing debt payment input.
 * Mapped to record_debt_payment(jsonb) snake_case payload.
 * CREDIT is not allowed.
 */
export type RecordDebtPaymentInput = {
  customerId: string;
  saleId: string;
  amount: number;
  method: DebtPaymentMethod;
  reference?: string | null;
  notes?: string | null;
};

export type RecordDebtPaymentResult = {
  id: string;
  sale_id: string | null;
  customer_id: string | null;
  amount: string | number;
  method: string;
  reference: string | null;
  notes: string | null;
  paid_at: string;
};

/**
 * Records a debt repayment via public.record_debt_payment(jsonb).
 * Sole client mutation path for debt payments — no direct table writes.
 */
export async function recordDebtPayment(
  input: RecordDebtPaymentInput,
): Promise<RecordDebtPaymentResult> {
  if (!input.customerId?.trim()) {
    throw new Error('A customer is required.');
  }
  if (!input.saleId?.trim()) {
    throw new Error('Select a sale with an outstanding balance.');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }
  if ((input.method as string) === 'CREDIT') {
    throw new Error('CREDIT cannot be used for debt repayment.');
  }
  if (!['CASH', 'MPESA', 'BANK'].includes(input.method)) {
    throw new Error('Select a valid payment method (Cash, M-Pesa, or Bank).');
  }

  const payload = {
    customer_id: input.customerId.trim(),
    sale_id: input.saleId.trim(),
    amount: input.amount,
    method: input.method,
    reference: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('record_debt_payment', { payload });

  if (error) {
    if (typeof console !== 'undefined') {
      console.error('[record_debt_payment]', error.message, error);
    }
    throw mapDebtError(error.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Payment recorded but no confirmation was returned.');
  }

  return data as RecordDebtPaymentResult;
}
