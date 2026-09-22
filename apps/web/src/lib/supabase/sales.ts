import { createClient } from '@/lib/supabase/client';

export type SalePaymentMethod = 'CASH' | 'MPESA' | 'BANK';
export type SaleDiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';

export type CreateSaleItemInput = {
  productId: string;
  quantity: number;
};

export type CreateSalePaymentInput = {
  method: SalePaymentMethod;
  amount: number;
  reference?: string | null;
};

/**
 * App-facing create-sale input (camelCase).
 * Mapped to the create_sale(jsonb) snake_case contract before the RPC call.
 *
 * IMPORTANT: Do not send CREDIT payment lines for unpaid balance.
 * Unpaid amount becomes amount_due inside the RPC.
 */
export type CreateSaleInput = {
  customerId?: string | null;
  items: CreateSaleItemInput[];
  discountType?: SaleDiscountType;
  discountValue?: number;
  payments: CreateSalePaymentInput[];
  notes?: string | null;
};

export type CreateSaleResult = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  cashier_id: string;
  status: string;
  subtotal: string | number;
  discount_type: string;
  discount_value: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  total_cost: string | number;
  total_profit: string | number;
  amount_paid: string | number;
  amount_due: string | number;
  payment_status: string;
  notes: string | null;
  sold_at: string;
  items: unknown[];
  payments: unknown[];
};

function mapSaleError(message: string): Error {
  const raw = message || 'Sale request failed.';
  const lower = raw.toLowerCase();

  if (/not authenticated|jwt|session|login required|auth/i.test(raw)) {
    return new Error('You must be signed in to complete a sale.');
  }
  if (/insufficient permissions|inactive staff|require_active_staff|42501/i.test(raw)) {
    return new Error('Your account cannot complete sales. Contact an administrator.');
  }
  if (/insufficient stock/i.test(raw)) {
    return new Error(raw.replace(/^.*?(Insufficient stock)/i, '$1').trim() || 'Insufficient stock.');
  }
  if (/product is not active/i.test(raw)) {
    return new Error(raw.includes(':') ? raw : 'One or more products are not active.');
  }
  if (/product not found/i.test(raw)) {
    return new Error('One or more products were not found.');
  }
  if (/customer not found or inactive/i.test(raw)) {
    return new Error('Selected customer was not found or is inactive.');
  }
  if (/credit sales require/i.test(raw)) {
    return new Error('Credit sales require an active registered customer.');
  }
  if (/payment amount exceeds/i.test(raw)) {
    return new Error('Payment amount exceeds sale total.');
  }
  if (/percentage discount/i.test(raw)) {
    return new Error('Percentage discount must be between 0 and 100.');
  }
  if (/fixed discount cannot be negative/i.test(raw)) {
    return new Error('Fixed discount cannot be negative.');
  }
  if (/fixed discount cannot exceed/i.test(raw)) {
    return new Error('Fixed discount cannot exceed subtotal.');
  }
  if (/sale requires at least one item/i.test(raw)) {
    return new Error('Cart is empty.');
  }
  if (/each sale item needs/i.test(raw)) {
    return new Error('Each cart item needs a valid product and quantity of at least 1.');
  }
  if (/invalid sale payload/i.test(raw)) {
    return new Error('Invalid sale data. Please try again.');
  }
  if (/row-level security|permission|policy/i.test(raw)) {
    return new Error('You do not have permission to complete this sale.');
  }

  // Keep a readable message; avoid dumping Postgres internals to the UI.
  if (lower.includes('pq:') || lower.includes('plpgsql') || lower.includes('context:')) {
    if (typeof console !== 'undefined') {
      console.error('[create_sale]', raw);
    }
    return new Error('Unable to complete sale. Please try again.');
  }

  return new Error(raw);
}

/**
 * Completes a sale via public.create_sale(jsonb).
 * Sole client mutation path for sales — no direct table writes.
 */
export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  if (!input.items?.length) {
    throw new Error('Cart is empty.');
  }

  for (const item of input.items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Each cart item needs a valid product and quantity of at least 1.');
    }
  }

  // Money payments only — never append CREDIT for unpaid balance.
  const payments = (input.payments ?? [])
    .filter((p) => p.amount > 0)
    .map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference?.trim() || null,
    }));

  for (const p of payments) {
    if ((p.method as string) === 'CREDIT') {
      throw new Error('CREDIT cannot be used as a payment line. Leave the unpaid amount as debt.');
    }
    if (p.amount < 0) {
      throw new Error('Payment amount cannot be negative.');
    }
  }

  const payload = {
    customer_id: input.customerId?.trim() || null,
    items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    discount_type: input.discountType ?? 'NONE',
    discount_value: input.discountValue ?? 0,
    payments,
    notes: input.notes?.trim() || null,
  };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_sale', { payload });

  if (error) {
    if (typeof console !== 'undefined') {
      console.error('[create_sale]', error.message, error);
    }
    throw mapSaleError(error.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Sale completed but no confirmation was returned.');
  }

  return data as CreateSaleResult;
}
