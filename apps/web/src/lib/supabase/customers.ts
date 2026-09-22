import { createClient } from '@/lib/supabase/client';

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_walk_in: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerAccountRow = {
  customer_id: string;
  total_purchases: string | number;
  total_paid: string | number;
  outstanding_balance: string | number;
};

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isWalkIn: boolean;
  isActive: boolean;
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
};

export type CreateCustomerInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isWalkIn?: boolean;
};

export type UpdateCustomerInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isWalkIn?: boolean;
  isActive?: boolean;
  // Intentionally no total_purchases / total_paid / outstanding_balance
};

export type CustomerAccountSummary = {
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapCustomerError(message: string): Error {
  if (/duplicate key|unique/i.test(message) && /phone/i.test(message)) {
    return new Error('A customer with this phone number already exists.');
  }
  if (/duplicate key|unique/i.test(message)) {
    return new Error('This customer conflicts with an existing record.');
  }
  if (/row-level security|permission|policy/i.test(message)) {
    return new Error('You do not have permission to change customers.');
  }
  return new Error(message || 'Customer request failed.');
}

function toListItem(
  row: CustomerRow & { account?: CustomerAccountRow | CustomerAccountRow[] | null },
): CustomerListItem {
  const account = Array.isArray(row.account) ? row.account[0] : row.account;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isWalkIn: row.is_walk_in,
    isActive: row.is_active,
    totalPurchases: moneyString(account?.total_purchases),
    totalPaid: moneyString(account?.total_paid),
    outstandingBalance: moneyString(account?.outstanding_balance),
  };
}

/**
 * List customers with read-only account balances.
 * Does not write to customer_accounts.
 */
export async function fetchCustomers(options?: {
  search?: string;
  includeInactive?: boolean;
  includeWalkIn?: boolean;
}): Promise<CustomerListItem[]> {
  const supabase = createClient();

  let query = supabase
    .from('customers')
    .select(
      `
      id,
      name,
      phone,
      email,
      address,
      notes,
      is_walk_in,
      is_active,
      created_at,
      updated_at,
      account:customer_accounts (
        customer_id,
        total_purchases,
        total_paid,
        outstanding_balance
      )
    `,
    )
    .order('name', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  if (!options?.includeWalkIn) {
    query = query.eq('is_walk_in', false);
  }

  const search = options?.search?.trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(`name.ilike.${pattern},phone.ilike.${pattern}`);
    }
  }

  const { data, error } = await query;
  if (error) throw mapCustomerError(error.message);

  return ((data ?? []) as unknown as Array<
    CustomerRow & { account?: CustomerAccountRow | CustomerAccountRow[] | null }
  >).map(toListItem);
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerListItem> {
  const supabase = createClient();
  const name = input.name.trim();
  if (name.length < 1) throw new Error('Customer name is required.');

  const phone = input.phone?.trim() || null;

  // Insert customers only. customer_accounts row is created by DB trigger.
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      phone,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      is_walk_in: input.isWalkIn ?? false,
      is_active: true,
    })
    .select(
      `
      id,
      name,
      phone,
      email,
      address,
      notes,
      is_walk_in,
      is_active,
      created_at,
      updated_at,
      account:customer_accounts (
        customer_id,
        total_purchases,
        total_paid,
        outstanding_balance
      )
    `,
    )
    .single();

  if (error) throw mapCustomerError(error.message);
  return toListItem(
    data as unknown as CustomerRow & {
      account?: CustomerAccountRow | CustomerAccountRow[] | null;
    },
  );
}

/**
 * Catalog/contact update only. Never writes customer_accounts financial fields.
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<CustomerListItem> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1) throw new Error('Customer name is required.');
    payload.name = name;
  }
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.address !== undefined) payload.address = input.address?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  if (input.isWalkIn !== undefined) payload.is_walk_in = input.isWalkIn;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .select(
      `
      id,
      name,
      phone,
      email,
      address,
      notes,
      is_walk_in,
      is_active,
      created_at,
      updated_at,
      account:customer_accounts (
        customer_id,
        total_purchases,
        total_paid,
        outstanding_balance
      )
    `,
    )
    .single();

  if (error) throw mapCustomerError(error.message);
  return toListItem(
    data as unknown as CustomerRow & {
      account?: CustomerAccountRow | CustomerAccountRow[] | null;
    },
  );
}

export async function setCustomerActive(
  id: string,
  isActive: boolean,
): Promise<CustomerListItem> {
  return updateCustomer(id, { isActive });
}

/**
 * Find an active non-walk-in customer by exact phone (POS phone lookup).
 * Does not create customers.
 */
export async function fetchCustomerByPhone(phone: string): Promise<CustomerListItem> {
  const normalized = phone.trim();
  if (!normalized) {
    throw new Error('Phone number is required.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      name,
      phone,
      email,
      address,
      notes,
      is_walk_in,
      is_active,
      created_at,
      updated_at,
      account:customer_accounts (
        customer_id,
        total_purchases,
        total_paid,
        outstanding_balance
      )
    `,
    )
    .eq('phone', normalized)
    .eq('is_active', true)
    .eq('is_walk_in', false)
    .maybeSingle();

  if (error) throw mapCustomerError(error.message);
  if (!data) throw new Error('Customer not found');

  return toListItem(
    data as unknown as CustomerRow & {
      account?: CustomerAccountRow | CustomerAccountRow[] | null;
    },
  );
}

/**
 * Read-only account snapshot for the ledger popup.
 * Does not query or write customer_transactions (later phase).
 * Does not mutate customer_accounts.
 */
export async function fetchCustomerAccountSummary(
  customerId: string,
): Promise<CustomerAccountSummary> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('customer_accounts')
    .select('total_purchases, total_paid, outstanding_balance')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw mapCustomerError(error.message);

  return {
    totalPurchases: moneyString(data?.total_purchases),
    totalPaid: moneyString(data?.total_paid),
    outstandingBalance: moneyString(data?.outstanding_balance),
  };
}
