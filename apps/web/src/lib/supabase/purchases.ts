import { createClient } from '@/lib/supabase/client';
import type { DateRangePreset } from '@bries/types';
import { resolveSoldAtRange } from '@/lib/supabase/sales-history';

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type PurchasePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export type PurchaseListItem = {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  createdById: string;
  createdByName: string;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  subtotal: string;
  totalAmount: string;
  amountPaid: string;
  notes: string | null;
  purchaseDate: string;
  receivedAt: string | null;
};

export type PurchaseItemDetail = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: string;
  lineTotal: string;
};

export type PurchaseDetail = PurchaseListItem & {
  items: PurchaseItemDetail[];
};

export type ListPurchasesFilters = {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
  search?: string;
  status?: PurchaseStatus | 'ALL';
  paymentStatus?: PurchasePaymentStatus | 'ALL';
  limit?: number;
};

type PurchaseRow = {
  id: string;
  reference: string;
  supplier_id: string;
  created_by_id: string;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  subtotal: string | number;
  total_amount: string | number;
  amount_paid: string | number;
  notes: string | null;
  purchase_date: string;
  received_at: string | null;
  supplier?: { id: string; name: string } | null;
  created_by?: { id: string; first_name: string; last_name: string } | null;
};

type PurchaseItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: string | number;
  line_total: string | number;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapPurchaseError(message: string): Error {
  const raw = message || 'Unable to load purchases.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to manage purchases.');
  }
  if (/insufficient permissions|inactive staff|require_active_staff|42501/i.test(raw)) {
    return new Error('Your account cannot receive purchases. Contact an administrator.');
  }
  if (/row-level security|permission|policy/i.test(raw)) {
    return new Error('You do not have permission to manage purchases.');
  }
  if (/supplier_id is required/i.test(raw)) {
    return new Error('Select a supplier.');
  }
  if (/supplier not found or inactive/i.test(raw)) {
    return new Error('Supplier not found or inactive.');
  }
  if (/purchase requires at least one item/i.test(raw)) {
    return new Error('Add at least one product line.');
  }
  if (/product not found/i.test(raw)) {
    return new Error('One or more products were not found.');
  }
  if (/only active products/i.test(raw)) {
    return new Error('Only active products can be received.');
  }
  if (/quantity >= 1|needs product_id and quantity/i.test(raw)) {
    return new Error('Each line needs a product and quantity of at least 1.');
  }
  if (/unit_cost must be/i.test(raw)) {
    return new Error('Unit cost must be 0 or greater.');
  }
  if (/amount_paid must be between/i.test(raw)) {
    return new Error('Amount paid must be between 0 and the purchase total.');
  }
  if (/invalid purchase payload/i.test(raw)) {
    return new Error('Invalid purchase data. Please try again.');
  }
  if (/duplicate key|unique/i.test(raw) && /reference/i.test(raw)) {
    return new Error('A purchase with this reference already exists.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[purchases]', raw);
    return new Error('Unable to complete purchase. Please try again.');
  }
  return new Error(raw);
}

function profileName(
  person: { first_name?: string; last_name?: string } | null | undefined,
): string {
  if (!person) return '—';
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return name || '—';
}

function toListItem(row: PurchaseRow): PurchaseListItem {
  return {
    id: row.id,
    reference: row.reference,
    supplierId: row.supplier_id,
    supplierName: row.supplier?.name ?? '—',
    createdById: row.created_by_id,
    createdByName: profileName(row.created_by),
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal: moneyString(row.subtotal),
    totalAmount: moneyString(row.total_amount),
    amountPaid: moneyString(row.amount_paid),
    notes: row.notes,
    purchaseDate: row.purchase_date,
    receivedAt: row.received_at,
  };
}

const PURCHASE_LIST_SELECT = `
  id,
  reference,
  supplier_id,
  created_by_id,
  status,
  payment_status,
  subtotal,
  total_amount,
  amount_paid,
  notes,
  purchase_date,
  received_at,
  supplier:suppliers ( id, name ),
  created_by:profiles!purchases_created_by_id_fkey ( id, first_name, last_name )
`;

/**
 * Read-only purchase history from public.purchases.
 * Does not write purchases, items, stock, or inventory.
 */
export async function listPurchases(
  filters: ListPurchasesFilters = {},
): Promise<PurchaseListItem[]> {
  const supabase = createClient();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

  let query = supabase
    .from('purchases')
    .select(PURCHASE_LIST_SELECT)
    .order('purchase_date', { ascending: false })
    .limit(limit);

  if (filters.preset || filters.from || filters.to) {
    const range = resolveSoldAtRange(
      filters.preset ?? 'today',
      filters.from,
      filters.to,
    );
    query = query
      .gte('purchase_date', range.from.toISOString())
      .lte('purchase_date', range.to.toISOString());
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    query = query.eq('payment_status', filters.paymentStatus);
  }

  const { data, error } = await query;
  if (error) throw mapPurchaseError(error.message);

  let rows = ((data ?? []) as unknown as PurchaseRow[]).map(toListItem);

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (r) =>
        r.reference.toLowerCase().includes(search) ||
        r.supplierName.toLowerCase().includes(search) ||
        r.createdByName.toLowerCase().includes(search),
    );
  }

  return rows;
}

/**
 * Read-only purchase detail: header + purchase_items.
 */
export async function getPurchaseById(id: string): Promise<PurchaseDetail> {
  if (!id.trim()) throw new Error('Purchase id is required.');

  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      ${PURCHASE_LIST_SELECT},
      items:purchase_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        line_total
      )
    `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapPurchaseError(error.message);
  if (!data) throw new Error('Purchase not found.');

  const row = data as unknown as PurchaseRow & {
    items?: PurchaseItemRow[] | null;
  };

  const base = toListItem(row);
  const items = (row.items ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (item): PurchaseItemDetail => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitCost: moneyString(item.unit_cost),
        lineTotal: moneyString(item.line_total),
      }),
    );

  return { ...base, items };
}

/** Round money to 2 decimals (matches public.money_round intent for UI validation). */
export function moneyRound(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Derive payment_status for receive_purchase — RPC does not compute this from amount_paid.
 */
export function derivePurchasePaymentStatus(
  amountPaid: number,
  totalAmount: number,
): Exclude<PurchasePaymentStatus, 'CANCELLED'> {
  const paid = moneyRound(amountPaid);
  const total = moneyRound(totalAmount);
  if (paid <= 0) return 'PENDING';
  if (total > 0 && paid < total) return 'PARTIAL';
  return 'PAID';
}

export type ReceivePurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost: number;
};

export type ReceivePurchaseInput = {
  supplierId: string;
  reference?: string | null;
  amountPaid: number;
  /** Preview total used only to derive payment_status and validate amount_paid. */
  previewTotal: number;
  purchaseDate?: string | null;
  notes?: string | null;
  items: ReceivePurchaseItemInput[];
};

export type ReceivePurchaseResult = {
  id: string;
  reference: string;
  supplier_id: string;
  created_by_id: string;
  status: string;
  payment_status: string;
  subtotal: string | number;
  total_amount: string | number;
  amount_paid: string | number;
  notes: string | null;
  purchase_date: string;
  received_at: string | null;
  items: unknown[];
};

/**
 * Receive a purchase via public.receive_purchase(jsonb).
 * Sole client mutation path — no direct table writes.
 */
export async function receivePurchase(
  input: ReceivePurchaseInput,
): Promise<ReceivePurchaseResult> {
  if (!input.supplierId?.trim()) {
    throw new Error('Select a supplier.');
  }
  if (!input.items?.length) {
    throw new Error('Add at least one product line.');
  }

  const items = input.items.map((item) => {
    if (!item.productId?.trim()) {
      throw new Error('Each line needs a product.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Each line needs a quantity of at least 1.');
    }
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
      throw new Error('Unit cost must be 0 or greater.');
    }
    return {
      product_id: item.productId.trim(),
      quantity: item.quantity,
      unit_cost: moneyRound(item.unitCost),
    };
  });

  const productIds = items.map((i) => i.product_id);
  if (new Set(productIds).size !== productIds.length) {
    throw new Error('Each product can only appear once in the purchase.');
  }

  const previewTotal = moneyRound(input.previewTotal);
  const amountPaid = moneyRound(input.amountPaid);

  if (amountPaid < 0) {
    throw new Error('Amount paid cannot be negative.');
  }
  if (amountPaid > previewTotal) {
    throw new Error('Amount paid cannot exceed the purchase total.');
  }

  // Zero-total purchases: amount_paid 0 → PENDING (do not force PAID).
  const paymentStatus =
    previewTotal === 0 && amountPaid === 0
      ? 'PENDING'
      : derivePurchasePaymentStatus(amountPaid, previewTotal);

  const payload = {
    supplier_id: input.supplierId.trim(),
    reference: input.reference?.trim() || null,
    payment_status: paymentStatus,
    amount_paid: amountPaid,
    purchase_date: input.purchaseDate?.trim() || null,
    notes: input.notes?.trim() || null,
    items,
  };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('receive_purchase', { payload });

  if (error) {
    if (typeof console !== 'undefined') {
      console.error('[receive_purchase]', error.message, error);
    }
    throw mapPurchaseError(error.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Purchase received but no confirmation was returned.');
  }

  return data as ReceivePurchaseResult;
}
