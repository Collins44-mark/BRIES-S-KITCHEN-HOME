import { createClient } from '@/lib/supabase/client';

/** Matches public.product_status enum. */
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

/** Computed in the app — not stored in the database. */
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  cost_price: string;
  selling_price: string;
  stock_quantity: number;
  reorder_level: number;
  unit: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
};

export type ProductListItem = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: number;
  reorderLevel: number;
  unit: string;
  status: ProductStatus;
  stockStatus: StockStatus;
};

export type CreateProductInput = {
  sku: string;
  name: string;
  categoryId: string;
  /** Initial catalog cost on INSERT only (required by DB). Not used on update. */
  costPrice: number;
  sellingPrice: number;
  reorderLevel?: number;
  unit?: string;
  barcode?: string | null;
  description?: string | null;
  status?: ProductStatus;
};

export type UpdateProductInput = {
  sku?: string;
  name?: string;
  categoryId?: string;
  sellingPrice?: number;
  reorderLevel?: number;
  unit?: string;
  barcode?: string | null;
  description?: string | null;
  status?: ProductStatus;
  // Intentionally no stock_quantity / cost_price
};

function computeStockStatus(stockQuantity: number, reorderLevel: number): StockStatus {
  if (stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (stockQuantity <= reorderLevel) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function mapProductError(message: string): Error {
  if (/duplicate key|unique/i.test(message) && /sku/i.test(message)) {
    return new Error('A product with this SKU already exists.');
  }
  if (/duplicate key|unique/i.test(message) && /barcode/i.test(message)) {
    return new Error('A product with this barcode already exists.');
  }
  if (/duplicate key|unique/i.test(message)) {
    return new Error('A product with this SKU or barcode already exists.');
  }
  if (/stock_quantity|cost_price|Direct updates/i.test(message)) {
    return new Error(
      'Stock and cost price cannot be changed here. Use purchases or inventory workflows.',
    );
  }
  if (/row-level security|permission|policy/i.test(message)) {
    return new Error('You do not have permission to change products.');
  }
  return new Error(message || 'Product request failed.');
}

function toListItem(row: ProductRow): ProductListItem {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? '—',
    costPrice: String(row.cost_price),
    sellingPrice: String(row.selling_price),
    stockQuantity: row.stock_quantity,
    reorderLevel: row.reorder_level,
    unit: row.unit,
    status: row.status,
    stockStatus: computeStockStatus(row.stock_quantity, row.reorder_level),
  };
}

export async function listProducts(options?: {
  search?: string;
  categoryId?: string;
  status?: ProductStatus | 'ALL';
}): Promise<ProductListItem[]> {
  const supabase = createClient();

  let query = supabase
    .from('products')
    .select(
      `
      id,
      sku,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      reorder_level,
      unit,
      status,
      created_at,
      updated_at,
      category:categories ( id, name )
    `,
    )
    .order('name', { ascending: true });

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  if (options?.status && options.status !== 'ALL') {
    query = query.eq('status', options.status);
  } else {
    // Match previous Nest list behavior: hide discontinued by default
    query = query.neq('status', 'DISCONTINUED');
  }

  const search = options?.search?.trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(`name.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`);
    }
  }

  const { data, error } = await query;
  if (error) throw mapProductError(error.message);

  return ((data ?? []) as unknown as ProductRow[]).map(toListItem);
}

export async function createProduct(input: CreateProductInput): Promise<ProductListItem> {
  const supabase = createClient();

  const sku = input.sku.trim();
  const name = input.name.trim();
  if (sku.length < 1) throw new Error('SKU is required.');
  if (name.length < 1) throw new Error('Product name is required.');
  if (!input.categoryId) throw new Error('Category is required.');
  if (input.sellingPrice < 0 || input.costPrice < 0) {
    throw new Error('Prices cannot be negative.');
  }

  const barcode = input.barcode?.trim() || null;

  const { data, error } = await supabase
    .from('products')
    .insert({
      sku,
      name,
      category_id: input.categoryId,
      // Initial INSERT values only — never updated via updateProduct.
      cost_price: input.costPrice,
      selling_price: input.sellingPrice,
      stock_quantity: 0,
      reorder_level: input.reorderLevel ?? 10,
      unit: input.unit?.trim() || 'pcs',
      barcode,
      description: input.description?.trim() || null,
      status: input.status ?? 'ACTIVE',
    })
    .select(
      `
      id,
      sku,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      reorder_level,
      unit,
      status,
      created_at,
      updated_at,
      category:categories ( id, name )
    `,
    )
    .single();

  if (error) throw mapProductError(error.message);
  return toListItem(data as unknown as ProductRow);
}

/**
 * Catalog update only. Never writes stock_quantity or cost_price
 * (blocked by DB trigger; also omitted here).
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ProductListItem> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (input.sku !== undefined) {
    const sku = input.sku.trim();
    if (sku.length < 1) throw new Error('SKU is required.');
    payload.sku = sku;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1) throw new Error('Product name is required.');
    payload.name = name;
  }
  if (input.categoryId !== undefined) {
    if (!input.categoryId) throw new Error('Category is required.');
    payload.category_id = input.categoryId;
  }
  if (input.sellingPrice !== undefined) {
    if (input.sellingPrice < 0) throw new Error('Selling price cannot be negative.');
    payload.selling_price = input.sellingPrice;
  }
  if (input.reorderLevel !== undefined) {
    if (input.reorderLevel < 0) throw new Error('Reorder level cannot be negative.');
    payload.reorder_level = input.reorderLevel;
  }
  if (input.unit !== undefined) {
    payload.unit = input.unit.trim() || 'pcs';
  }
  if (input.barcode !== undefined) {
    payload.barcode = input.barcode?.trim() || null;
  }
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select(
      `
      id,
      sku,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      reorder_level,
      unit,
      status,
      created_at,
      updated_at,
      category:categories ( id, name )
    `,
    )
    .single();

  if (error) throw mapProductError(error.message);
  return toListItem(data as unknown as ProductRow);
}

export async function setProductStatus(
  id: string,
  status: ProductStatus,
): Promise<ProductListItem> {
  return updateProduct(id, { status });
}
