import { createClient } from '@/lib/supabase/client';
import type { DateRangePreset } from '@bries/types';
import { resolveSoldAtRange } from '@/lib/supabase/sales-history';

/** Expense payment methods — CREDIT is blocked by DB check. */
export type ExpensePaymentMethod = 'CASH' | 'MPESA' | 'BANK';

export type ExpenseListItem = {
  id: string;
  title: string;
  category: string;
  amount: string;
  paymentMethod: ExpensePaymentMethod;
  description: string | null;
  expenseDate: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ListExpensesFilters = {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
  category?: string;
  paymentMethod?: ExpensePaymentMethod | 'ALL';
  search?: string;
};

export type CreateExpenseInput = {
  title: string;
  category: string;
  amount: number;
  paymentMethod?: ExpensePaymentMethod;
  description?: string | null;
  /** ISO date or datetime; defaults to now. */
  expenseDate?: string | null;
};

type ExpenseRow = {
  id: string;
  title: string;
  category: string;
  amount: string | number;
  payment_method: ExpensePaymentMethod;
  description: string | null;
  expense_date: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
};

const ALLOWED_METHODS = new Set<ExpensePaymentMethod>(['CASH', 'MPESA', 'BANK']);

const EXPENSE_SELECT =
  'id, title, category, amount, payment_method, description, expense_date, created_by_id, created_at, updated_at';

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapExpenseError(message: string): Error {
  const raw = message || 'Expense request failed.';
  if (/expenses_amount_nonneg|amount/i.test(raw) && /check|violates/i.test(raw)) {
    return new Error('Amount must be zero or greater.');
  }
  if (/expenses_method_not_credit|CREDIT/i.test(raw)) {
    return new Error('Credit cannot be used for expenses.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to manage expenses.');
  }
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to manage expenses.');
  }
  if (/foreign key|violates foreign key/i.test(raw)) {
    return new Error('Unable to save expense. Please sign in again.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[expenses]', raw);
    return new Error('Unable to complete expense request. Please try again.');
  }
  return new Error(raw);
}

function toListItem(row: ExpenseRow): ExpenseListItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: moneyString(row.amount),
    paymentMethod: row.payment_method,
    description: row.description,
    expenseDate: row.expense_date,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateCreateInput(input: CreateExpenseInput): {
  title: string;
  category: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  description: string | null;
  expenseDate: string;
} {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required.');

  const category = input.category.trim();
  if (!category) throw new Error('Category is required.');

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const paymentMethod = (input.paymentMethod ?? 'CASH') as ExpensePaymentMethod;
  if (!ALLOWED_METHODS.has(paymentMethod)) {
    throw new Error('Choose a valid payment method (Cash, M-Pesa, or Bank).');
  }

  const description = input.description?.trim() || null;

  let expenseDate: string;
  if (input.expenseDate?.trim()) {
    const parsed = new Date(input.expenseDate.trim());
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Expense date is not valid.');
    }
    expenseDate = parsed.toISOString();
  } else {
    expenseDate = new Date().toISOString();
  }

  return { title, category, amount, paymentMethod, description, expenseDate };
}

/**
 * Read-only list from public.expenses.
 * Filters by expense_date using the shared date-range preset.
 */
export async function listExpenses(
  filters: ListExpensesFilters = {},
): Promise<ExpenseListItem[]> {
  const supabase = createClient();
  const range = resolveSoldAtRange(
    filters.preset ?? 'today',
    filters.from,
    filters.to,
  );

  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .gte('expense_date', range.from.toISOString())
    .lte('expense_date', range.to.toISOString())
    .order('expense_date', { ascending: false });

  if (filters.category?.trim()) {
    query = query.eq('category', filters.category.trim());
  }

  if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  const search = filters.search?.trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `title.ilike.${pattern},category.ilike.${pattern},description.ilike.${pattern}`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw mapExpenseError(error.message);

  return ((data ?? []) as ExpenseRow[]).map(toListItem);
}

/**
 * Insert into public.expenses.
 * created_by_id is always the authenticated user (RLS requires auth.uid()).
 * Never accepts a client-supplied created_by.
 */
export async function createExpense(
  input: CreateExpenseInput,
): Promise<ExpenseListItem> {
  const payload = validateCreateInput(input);
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw mapExpenseError(authError.message);
  if (!user) throw new Error('You must be signed in to record an expense.');

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      title: payload.title,
      category: payload.category,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      description: payload.description,
      expense_date: payload.expenseDate,
      created_by_id: user.id,
    })
    .select(EXPENSE_SELECT)
    .single();

  if (error) throw mapExpenseError(error.message);
  return toListItem(data as ExpenseRow);
}
