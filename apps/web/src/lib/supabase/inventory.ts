import { createClient } from '@/lib/supabase/client';
import type { DateRangePreset } from '@bries/types';
import { resolveSoldAtRange } from '@/lib/supabase/sales-history';

/** Matches existing Nest / products helper naming. */
export type InventoryStockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export type InventoryMovementType =
  | 'PURCHASE'
  | 'PURCHASE_REVERSAL'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS';

export type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  stockQuantity: number;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  stockStatus: InventoryStockStatus;
};

export type InventoryOverview = {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalStockValue: string;
  products: InventoryProduct[];
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  type: InventoryMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdById: string | null;
  createdByName: string;
};

export type InventoryProductDetails = InventoryProduct & {
  recentMovements: InventoryMovement[];
};

export type ListInventoryFilters = {
  search?: string;
  categoryId?: string;
  stockStatus?: InventoryStockStatus | 'ALL';
};

export type ListMovementsFilters = {
  productId?: string;
  type?: InventoryMovementType | 'ALL';
  preset?: DateRangePreset;
  from?: string;
  to?: string;
  limit?: number;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  stock_quantity: number;
  unit: string;
  cost_price: string | number;
  selling_price: string | number;
  reorder_level: number;
  category?: { id: string; name: string } | null;
};

type MovementRow = {
  id: string;
  product_id: string;
  type: InventoryMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: string | number | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  product?: { id: string; name: string } | null;
  creator?: { id: string; first_name: string; last_name: string } | null;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapInventoryError(message: string): Error {
  const raw = message || 'Unable to load inventory.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view inventory.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to view inventory.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[inventory]', raw);
    return new Error('Unable to load inventory. Please try again.');
  }
  return new Error(raw);
}

/** Existing rule: OUT ≤ 0, LOW ≤ reorder, else IN_STOCK. */
export function computeStockStatus(
  stockQuantity: number,
  reorderLevel: number,
): InventoryStockStatus {
  if (stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (stockQuantity <= reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function toInventoryProduct(row: ProductRow): InventoryProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? '—',
    stockQuantity: row.stock_quantity,
    unit: row.unit,
    costPrice: moneyString(row.cost_price),
    sellingPrice: moneyString(row.selling_price),
    reorderLevel: row.reorder_level,
    stockStatus: computeStockStatus(row.stock_quantity, row.reorder_level),
  };
}

function profileName(
  person: { first_name?: string; last_name?: string } | null | undefined,
): string {
  if (!person) return '—';
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return name || '—';
}

function toMovement(row: MovementRow): InventoryMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product?.name ?? '—',
    type: row.type,
    quantity: row.quantity,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    unitCost: row.unit_cost == null ? null : moneyString(row.unit_cost),
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
    createdById: row.created_by,
    createdByName: profileName(row.creator),
  };
}

/**
 * Read-only inventory overview from public.products.stock_quantity.
 * Does not sum inventory_movements for current stock.
 */
export async function listInventory(
  filters: ListInventoryFilters = {},
): Promise<InventoryOverview> {
  const supabase = createClient();

  let query = supabase
    .from('products')
    .select(
      `
      id,
      name,
      sku,
      category_id,
      stock_quantity,
      unit,
      cost_price,
      selling_price,
      reorder_level,
      category:categories ( id, name )
    `,
    )
    .neq('status', 'DISCONTINUED')
    .order('name', { ascending: true });

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  const search = filters.search?.trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(`name.ilike.${pattern},sku.ilike.${pattern}`);
    }
  }

  const { data, error } = await query;
  if (error) throw mapInventoryError(error.message);

  let products = ((data ?? []) as unknown as ProductRow[]).map(toInventoryProduct);

  if (filters.stockStatus && filters.stockStatus !== 'ALL') {
    products = products.filter((p) => p.stockStatus === filters.stockStatus);
  }

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let totalStockValue = 0;

  for (const p of products) {
    if (p.stockStatus === 'OUT_OF_STOCK') outOfStock += 1;
    else if (p.stockStatus === 'LOW_STOCK') lowStock += 1;
    else inStock += 1;
    totalStockValue += Number(p.costPrice) * p.stockQuantity;
  }

  return {
    inStock,
    lowStock,
    outOfStock,
    totalStockValue: totalStockValue.toFixed(2),
    products,
  };
}

/**
 * Read-only movement history from public.inventory_movements.
 */
export async function listInventoryMovements(
  filters: ListMovementsFilters = {},
): Promise<InventoryMovement[]> {
  const supabase = createClient();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  let query = supabase
    .from('inventory_movements')
    .select(
      `
      id,
      product_id,
      type,
      quantity,
      quantity_before,
      quantity_after,
      unit_cost,
      reference,
      notes,
      created_at,
      created_by,
      product:products ( id, name ),
      creator:profiles!inventory_movements_created_by_fkey ( id, first_name, last_name )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.productId) {
    query = query.eq('product_id', filters.productId);
  }
  if (filters.type && filters.type !== 'ALL') {
    query = query.eq('type', filters.type);
  }
  if (filters.preset || filters.from || filters.to) {
    const range = resolveSoldAtRange(
      filters.preset ?? 'this_month',
      filters.from,
      filters.to,
    );
    query = query
      .gte('created_at', range.from.toISOString())
      .lte('created_at', range.to.toISOString());
  }

  const { data, error } = await query;
  if (error) throw mapInventoryError(error.message);

  return ((data ?? []) as unknown as MovementRow[]).map(toMovement);
}

/**
 * Product inventory detail: current stock from products + recent movements.
 */
export async function getInventoryProductDetails(
  productId: string,
): Promise<InventoryProductDetails> {
  if (!productId.trim()) throw new Error('Product id is required.');

  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      sku,
      category_id,
      stock_quantity,
      unit,
      cost_price,
      selling_price,
      reorder_level,
      category:categories ( id, name )
    `,
    )
    .eq('id', productId)
    .maybeSingle();

  if (error) throw mapInventoryError(error.message);
  if (!data) throw new Error('Product not found.');

  const product = toInventoryProduct(data as unknown as ProductRow);
  const recentMovements = await listInventoryMovements({
    productId,
    limit: 25,
  });

  return { ...product, recentMovements };
}
