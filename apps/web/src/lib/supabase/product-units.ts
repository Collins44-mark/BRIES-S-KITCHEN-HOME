import { createClient } from '@/lib/supabase/client';

/** Matches public.product_unit_code — household/kitchenware only. */
export type ProductUnitCode = 'PCS' | 'SET' | 'PACK' | 'DOZEN' | 'BOX' | 'CARTON';

export const PRODUCT_UNIT_CODES: ProductUnitCode[] = [
  'PCS',
  'SET',
  'PACK',
  'DOZEN',
  'BOX',
  'CARTON',
];

export type ProductUnitRow = {
  id: string;
  product_id: string;
  unit_code: ProductUnitCode;
  unit_label: string | null;
  conversion_to_base: number;
  selling_price: string | number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductPriceTierRow = {
  id: string;
  product_unit_id: string;
  min_quantity: number;
  unit_price: string | number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductUnitListItem = {
  id: string;
  productId: string;
  unitCode: ProductUnitCode;
  unitLabel: string;
  conversionToBase: number;
  sellingPrice: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  /** Wholesale tiers for this selling unit (active-only when requested). */
  priceTiers: ProductPriceTierListItem[];
};

export type ProductPriceTierListItem = {
  id: string;
  productUnitId: string;
  minQuantity: number;
  unitPrice: string;
  isActive: boolean;
};

export type ProductUnitsCatalog = {
  productId: string;
  /** Legacy products.unit label (unchanged column). */
  baseUnitLabel: string;
  /** Cost per base unit from products.cost_price. */
  costPricePerBase: string;
  /** Base inventory from products.stock_quantity. */
  stockQuantityBase: number;
  /** Fallback retail from products.selling_price. */
  legacySellingPrice: string;
  units: ProductUnitListItem[];
  defaultUnit: ProductUnitListItem | null;
};

function moneyString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function mapUnitsError(message: string): Error {
  const raw = message || 'Unable to load product units.';
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to view product units.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to view product units.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[product-units]', raw);
    return new Error('Unable to load product units. Please try again.');
  }
  return new Error(raw);
}

function toTierItem(row: ProductPriceTierRow): ProductPriceTierListItem {
  return {
    id: row.id,
    productUnitId: row.product_unit_id,
    minQuantity: row.min_quantity,
    unitPrice: moneyString(row.unit_price),
    isActive: row.is_active,
  };
}

function toUnitItem(
  row: ProductUnitRow,
  tiers: ProductPriceTierListItem[] = [],
): ProductUnitListItem {
  return {
    id: row.id,
    productId: row.product_id,
    unitCode: row.unit_code,
    unitLabel: row.unit_label?.trim() || row.unit_code,
    conversionToBase: row.conversion_to_base,
    sellingPrice: moneyString(row.selling_price),
    isDefault: row.is_default,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    priceTiers: tiers
      .slice()
      .sort((a, b) => a.minQuantity - b.minQuantity || a.id.localeCompare(b.id)),
  };
}

/**
 * List selling units for a product (read-only).
 * Does not mutate configuration, stock, or prices.
 */
export async function listProductUnits(
  productId: string,
  options?: { includeInactive?: boolean },
): Promise<ProductUnitListItem[]> {
  if (!productId.trim()) throw new Error('Product id is required.');

  const supabase = createClient();
  let query = supabase
    .from('product_units')
    .select(
      `
      id,
      product_id,
      unit_code,
      unit_label,
      conversion_to_base,
      selling_price,
      is_default,
      is_active,
      sort_order,
      created_at,
      updated_at
    `,
    )
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('unit_code', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw mapUnitsError(error.message);

  return ((data ?? []) as ProductUnitRow[]).map((row) => toUnitItem(row));
}

/**
 * List wholesale price tiers for a selling unit (read-only).
 */
export async function listProductPriceTiers(
  productUnitId: string,
  options?: { includeInactive?: boolean },
): Promise<ProductPriceTierListItem[]> {
  if (!productUnitId.trim()) throw new Error('Product unit id is required.');

  const supabase = createClient();
  let query = supabase
    .from('product_price_tiers')
    .select(
      `
      id,
      product_unit_id,
      min_quantity,
      unit_price,
      is_active,
      created_at,
      updated_at
    `,
    )
    .eq('product_unit_id', productUnitId)
    .order('min_quantity', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw mapUnitsError(error.message);

  return ((data ?? []) as ProductPriceTierRow[]).map(toTierItem);
}

/**
 * Product catalog detail: base stock/cost + selling units + wholesale tiers.
 * Read-only — does not call create_sale or change inventory.
 */
export async function getProductUnitsCatalog(
  productId: string,
  options?: { includeInactive?: boolean },
): Promise<ProductUnitsCatalog> {
  if (!productId.trim()) throw new Error('Product id is required.');

  const supabase = createClient();
  const includeInactive = options?.includeInactive ?? false;

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, unit, cost_price, selling_price, stock_quantity')
    .eq('id', productId)
    .maybeSingle();

  if (productError) throw mapUnitsError(productError.message);
  if (!product) throw new Error('Product not found.');

  let unitsQuery = supabase
    .from('product_units')
    .select(
      `
      id,
      product_id,
      unit_code,
      unit_label,
      conversion_to_base,
      selling_price,
      is_default,
      is_active,
      sort_order,
      created_at,
      updated_at,
      tiers:product_price_tiers (
        id,
        product_unit_id,
        min_quantity,
        unit_price,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('unit_code', { ascending: true });

  if (!includeInactive) {
    unitsQuery = unitsQuery.eq('is_active', true);
  }

  const { data: unitRows, error: unitsError } = await unitsQuery;
  if (unitsError) throw mapUnitsError(unitsError.message);

  const units: ProductUnitListItem[] = (
    (unitRows ?? []) as unknown as Array<
      ProductUnitRow & { tiers?: ProductPriceTierRow[] | null }
    >
  ).map((row) => {
    const tiers = (row.tiers ?? [])
      .filter((t) => (includeInactive ? true : t.is_active))
      .map(toTierItem);
    return toUnitItem(row, tiers);
  });

  const defaultUnit =
    units.find((u) => u.isDefault && u.isActive) ??
    units.find((u) => u.unitCode === 'PCS' && u.isActive) ??
    units[0] ??
    null;

  return {
    productId: product.id as string,
    baseUnitLabel: String((product as { unit: string }).unit || 'pcs'),
    costPricePerBase: moneyString((product as { cost_price: string | number }).cost_price),
    stockQuantityBase: Number((product as { stock_quantity: number }).stock_quantity) || 0,
    legacySellingPrice: moneyString(
      (product as { selling_price: string | number }).selling_price,
    ),
    units,
    defaultUnit,
  };
}

/**
 * Batch-load active selling units (+ tiers) for POS product tiles.
 * Read-only. Keyed by product_id.
 */
export async function listActiveUnitsByProductIds(
  productIds: string[],
): Promise<Record<string, ProductUnitListItem[]>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return {};

  const supabase = createClient();
  const { data, error } = await supabase
    .from('product_units')
    .select(
      `
      id,
      product_id,
      unit_code,
      unit_label,
      conversion_to_base,
      selling_price,
      is_default,
      is_active,
      sort_order,
      created_at,
      updated_at,
      tiers:product_price_tiers (
        id,
        product_unit_id,
        min_quantity,
        unit_price,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .in('product_id', ids)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('unit_code', { ascending: true });

  if (error) throw mapUnitsError(error.message);

  const map: Record<string, ProductUnitListItem[]> = {};
  for (const id of ids) map[id] = [];

  for (const row of (data ?? []) as unknown as Array<
    ProductUnitRow & { tiers?: ProductPriceTierRow[] | null }
  >) {
    const tiers = (row.tiers ?? []).filter((t) => t.is_active).map(toTierItem);
    const item = toUnitItem(row, tiers);
    if (!map[item.productId]) map[item.productId] = [];
    map[item.productId].push(item);
  }

  return map;
}

/**
 * Available selling-unit qty from base stock (floor division).
 */
export function availableSellingQuantity(
  stockQuantityBase: number,
  conversionToBase: number,
): number {
  const conversion = Math.max(1, Math.floor(conversionToBase) || 1);
  const stock = Math.max(0, Math.floor(stockQuantityBase) || 0);
  return Math.floor(stock / conversion);
}

/**
 * Preview helper (UI only): pick wholesale/retail unit price for a selling qty.
 * Does not write; create_sale remains authoritative for final totals.
 */
export function resolveUnitPricePreview(
  unit: ProductUnitListItem,
  sellingQuantity: number,
): string {
  if (!Number.isFinite(sellingQuantity) || sellingQuantity < 1) {
    return unit.sellingPrice;
  }
  const activeTiers = unit.priceTiers
    .filter((t) => t.isActive)
    .sort((a, b) => b.minQuantity - a.minQuantity);
  const match = activeTiers.find((t) => sellingQuantity >= t.minQuantity);
  return match ? match.unitPrice : unit.sellingPrice;
}

// -----------------------------------------------------------------------------
// Write helpers (ADMIN / MANAGER via RLS) — configuration only; never touch stock
// -----------------------------------------------------------------------------

export type CreateProductUnitInput = {
  productId: string;
  unitCode: ProductUnitCode;
  unitLabel?: string | null;
  conversionToBase: number;
  sellingPrice: number;
  isDefault?: boolean;
  sortOrder?: number;
};

export type UpdateProductUnitInput = {
  unitLabel?: string | null;
  conversionToBase?: number;
  sellingPrice?: number;
  sortOrder?: number;
};

export type CreateProductPriceTierInput = {
  productUnitId: string;
  minQuantity: number;
  unitPrice: number;
};

export type UpdateProductPriceTierInput = {
  minQuantity?: number;
  unitPrice?: number;
};

function mapUnitsWriteError(message: string): Error {
  const raw = message || 'Unable to save selling unit.';
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to change selling units.');
  }
  if (/product_units_one_default_active|one_default/i.test(raw)) {
    return new Error('Each product must have exactly one active default selling unit.');
  }
  if (/product_units_product_code|product_code_uidx|duplicate key/i.test(raw) && /unit/i.test(raw)) {
    return new Error('This selling unit already exists for the product.');
  }
  if (/product_price_tiers_unit_min_active|duplicate key/i.test(raw)) {
    return new Error('An active wholesale tier with this minimum quantity already exists.');
  }
  if (/product_units_pcs_conversion|conversion/i.test(raw)) {
    return new Error('PCS conversion must be 1, and conversion must be an integer ≥ 1.');
  }
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to manage selling units.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[product-units]', raw);
    return new Error('Unable to save selling unit. Please try again.');
  }
  return new Error(raw);
}

function assertAllowedUnitCode(code: string): asserts code is ProductUnitCode {
  if (!(PRODUCT_UNIT_CODES as string[]).includes(code)) {
    throw new Error('Unit must be PCS, SET, PACK, DOZEN, BOX, or CARTON.');
  }
}

function assertConversion(unitCode: ProductUnitCode, conversionToBase: number): number {
  if (!Number.isInteger(conversionToBase) || conversionToBase < 1) {
    throw new Error('Conversion to base must be a whole number ≥ 1.');
  }
  if (unitCode === 'PCS' && conversionToBase !== 1) {
    throw new Error('PCS conversion to base must always be 1.');
  }
  return conversionToBase;
}

function assertPrice(value: number, label = 'Price'): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return value;
}

async function fetchUnitsForProduct(productId: string): Promise<ProductUnitListItem[]> {
  return listProductUnits(productId, { includeInactive: true });
}

async function clearOtherDefaults(productId: string, keepUnitId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('product_units')
    .update({ is_default: false })
    .eq('product_id', productId)
    .eq('is_default', true)
    .neq('id', keepUnitId);

  if (error) throw mapUnitsWriteError(error.message);
}

/**
 * Add a selling unit. If the same unit_code exists but is inactive, reactivates it.
 * Never deletes rows. Does not change products.stock_quantity.
 */
export async function createProductUnit(
  input: CreateProductUnitInput,
): Promise<ProductUnitListItem> {
  const productId = input.productId.trim();
  if (!productId) throw new Error('Product id is required.');
  assertAllowedUnitCode(input.unitCode);
  const conversion = assertConversion(input.unitCode, input.conversionToBase);
  const sellingPrice = assertPrice(input.sellingPrice, 'Selling price');
  const unitLabel = input.unitLabel?.trim() || input.unitCode;

  const existing = await fetchUnitsForProduct(productId);
  const sameCode = existing.find((u) => u.unitCode === input.unitCode);

  if (sameCode?.isActive) {
    throw new Error(`${input.unitCode} is already configured for this product.`);
  }

  const hasActiveDefaultElsewhere = existing.some(
    (u) => u.isActive && u.isDefault && (!sameCode || u.id !== sameCode.id),
  );
  // New unit is default only if requested, or if the product somehow has none.
  const forceDefault = Boolean(input.isDefault) || !hasActiveDefaultElsewhere;

  const supabase = createClient();

  if (forceDefault) {
    // Clear all defaults first (unique partial index allows only one active default).
    const { error: clearErr } = await supabase
      .from('product_units')
      .update({ is_default: false })
      .eq('product_id', productId)
      .eq('is_default', true);
    if (clearErr) throw mapUnitsWriteError(clearErr.message);
  }

  if (sameCode) {
    const { data, error } = await supabase
      .from('product_units')
      .update({
        unit_label: unitLabel,
        conversion_to_base: conversion,
        selling_price: sellingPrice,
        is_active: true,
        is_default: forceDefault,
        sort_order: input.sortOrder ?? sameCode.sortOrder,
      })
      .eq('id', sameCode.id)
      .select(
        `
        id, product_id, unit_code, unit_label, conversion_to_base,
        selling_price, is_default, is_active, sort_order, created_at, updated_at
      `,
      )
      .single();

    if (error) throw mapUnitsWriteError(error.message);
    return toUnitItem(data as ProductUnitRow, sameCode.priceTiers);
  }

  const { data, error } = await supabase
    .from('product_units')
    .insert({
      product_id: productId,
      unit_code: input.unitCode,
      unit_label: unitLabel,
      conversion_to_base: conversion,
      selling_price: sellingPrice,
      is_default: forceDefault,
      is_active: true,
      sort_order: input.sortOrder ?? existing.length,
    })
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toUnitItem(data as ProductUnitRow, []);
}

/**
 * Update retail/conversion/label for a selling unit. Does not change stock.
 */
export async function updateProductUnit(
  unitId: string,
  input: UpdateProductUnitInput,
): Promise<ProductUnitListItem> {
  if (!unitId.trim()) throw new Error('Unit id is required.');

  const supabase = createClient();
  const { data: current, error: loadError } = await supabase
    .from('product_units')
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .eq('id', unitId)
    .maybeSingle();

  if (loadError) throw mapUnitsWriteError(loadError.message);
  if (!current) throw new Error('Selling unit not found.');

  const row = current as ProductUnitRow;
  const payload: Record<string, unknown> = {};

  if (input.unitLabel !== undefined) {
    payload.unit_label = input.unitLabel?.trim() || row.unit_code;
  }
  if (input.conversionToBase !== undefined) {
    payload.conversion_to_base = assertConversion(row.unit_code, input.conversionToBase);
  }
  if (input.sellingPrice !== undefined) {
    payload.selling_price = assertPrice(input.sellingPrice, 'Selling price');
  }
  if (input.sortOrder !== undefined) {
    payload.sort_order = input.sortOrder;
  }

  if (Object.keys(payload).length === 0) {
    return toUnitItem(row);
  }

  const { data, error } = await supabase
    .from('product_units')
    .update(payload)
    .eq('id', unitId)
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toUnitItem(data as ProductUnitRow);
}

/**
 * Activate or deactivate a selling unit. Prefer deactivate over delete.
 * Blocks deactivating the only / current default without another default in place.
 */
export async function setProductUnitActive(
  unitId: string,
  isActive: boolean,
): Promise<ProductUnitListItem> {
  if (!unitId.trim()) throw new Error('Unit id is required.');

  const supabase = createClient();
  const { data: current, error: loadError } = await supabase
    .from('product_units')
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .eq('id', unitId)
    .maybeSingle();

  if (loadError) throw mapUnitsWriteError(loadError.message);
  if (!current) throw new Error('Selling unit not found.');

  const row = current as ProductUnitRow;

  if (!isActive) {
    if (row.is_default && row.is_active) {
      throw new Error(
        'Set another active selling unit as default before deactivating the current default.',
      );
    }
    const siblings = await fetchUnitsForProduct(row.product_id);
    const otherActiveDefault = siblings.some(
      (u) => u.id !== unitId && u.isActive && u.isDefault,
    );
    if (!otherActiveDefault && row.is_default) {
      throw new Error('A product must keep exactly one active default selling unit.');
    }
  }

  const { data, error } = await supabase
    .from('product_units')
    .update({ is_active: isActive })
    .eq('id', unitId)
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toUnitItem(data as ProductUnitRow);
}

/**
 * Make this unit the sole active default for the product (activates it if needed).
 */
export async function setDefaultProductUnit(unitId: string): Promise<ProductUnitListItem> {
  if (!unitId.trim()) throw new Error('Unit id is required.');

  const supabase = createClient();
  const { data: current, error: loadError } = await supabase
    .from('product_units')
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .eq('id', unitId)
    .maybeSingle();

  if (loadError) throw mapUnitsWriteError(loadError.message);
  if (!current) throw new Error('Selling unit not found.');

  const row = current as ProductUnitRow;

  await clearOtherDefaults(row.product_id, row.id);

  const { data, error } = await supabase
    .from('product_units')
    .update({ is_default: true, is_active: true })
    .eq('id', unitId)
    .select(
      `
      id, product_id, unit_code, unit_label, conversion_to_base,
      selling_price, is_default, is_active, sort_order, created_at, updated_at
    `,
    )
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toUnitItem(data as ProductUnitRow);
}

export async function createProductPriceTier(
  input: CreateProductPriceTierInput,
): Promise<ProductPriceTierListItem> {
  if (!input.productUnitId.trim()) throw new Error('Selling unit id is required.');
  if (!Number.isInteger(input.minQuantity) || input.minQuantity < 1) {
    throw new Error('Minimum quantity must be a whole number ≥ 1.');
  }
  const unitPrice = assertPrice(input.unitPrice, 'Unit price');

  const existing = await listProductPriceTiers(input.productUnitId, { includeInactive: true });
  const sameMin = existing.find((t) => t.minQuantity === input.minQuantity);
  if (sameMin?.isActive) {
    throw new Error('An active wholesale tier with this minimum quantity already exists.');
  }

  const supabase = createClient();

  if (sameMin) {
    const { data, error } = await supabase
      .from('product_price_tiers')
      .update({
        unit_price: unitPrice,
        is_active: true,
      })
      .eq('id', sameMin.id)
      .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
      .single();
    if (error) throw mapUnitsWriteError(error.message);
    return toTierItem(data as ProductPriceTierRow);
  }

  const { data, error } = await supabase
    .from('product_price_tiers')
    .insert({
      product_unit_id: input.productUnitId,
      min_quantity: input.minQuantity,
      unit_price: unitPrice,
      is_active: true,
    })
    .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toTierItem(data as ProductPriceTierRow);
}

export async function updateProductPriceTier(
  tierId: string,
  input: UpdateProductPriceTierInput,
): Promise<ProductPriceTierListItem> {
  if (!tierId.trim()) throw new Error('Price tier id is required.');

  const supabase = createClient();
  const { data: current, error: loadError } = await supabase
    .from('product_price_tiers')
    .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
    .eq('id', tierId)
    .maybeSingle();

  if (loadError) throw mapUnitsWriteError(loadError.message);
  if (!current) throw new Error('Wholesale tier not found.');

  const row = current as ProductPriceTierRow;
  const payload: Record<string, unknown> = {};

  if (input.minQuantity !== undefined) {
    if (!Number.isInteger(input.minQuantity) || input.minQuantity < 1) {
      throw new Error('Minimum quantity must be a whole number ≥ 1.');
    }
    payload.min_quantity = input.minQuantity;
  }
  if (input.unitPrice !== undefined) {
    payload.unit_price = assertPrice(input.unitPrice, 'Unit price');
  }

  if (Object.keys(payload).length === 0) {
    return toTierItem(row);
  }

  const { data, error } = await supabase
    .from('product_price_tiers')
    .update(payload)
    .eq('id', tierId)
    .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toTierItem(data as ProductPriceTierRow);
}

export async function setProductPriceTierActive(
  tierId: string,
  isActive: boolean,
): Promise<ProductPriceTierListItem> {
  if (!tierId.trim()) throw new Error('Price tier id is required.');

  const supabase = createClient();
  const { data: current, error: loadError } = await supabase
    .from('product_price_tiers')
    .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
    .eq('id', tierId)
    .maybeSingle();

  if (loadError) throw mapUnitsWriteError(loadError.message);
  if (!current) throw new Error('Wholesale tier not found.');

  const row = current as ProductPriceTierRow;

  if (isActive) {
    const siblings = await listProductPriceTiers(row.product_unit_id, { includeInactive: false });
    if (siblings.some((t) => t.id !== tierId && t.minQuantity === row.min_quantity)) {
      throw new Error('An active wholesale tier with this minimum quantity already exists.');
    }
  }

  const { data, error } = await supabase
    .from('product_price_tiers')
    .update({ is_active: isActive })
    .eq('id', tierId)
    .select('id, product_unit_id, min_quantity, unit_price, is_active, created_at, updated_at')
    .single();

  if (error) throw mapUnitsWriteError(error.message);
  return toTierItem(data as ProductPriceTierRow);
}
