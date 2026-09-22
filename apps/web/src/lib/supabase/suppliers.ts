import { createClient } from '@/lib/supabase/client';

export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupplierInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export type UpdateSupplierInput = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

function mapSupplierError(message: string): Error {
  const raw = message || 'Supplier request failed.';
  if (/duplicate key|unique/i.test(raw) && /name/i.test(raw)) {
    return new Error('A supplier with this name already exists.');
  }
  if (/duplicate key|unique/i.test(raw)) {
    return new Error('This supplier conflicts with an existing record.');
  }
  if (/foreign key|violates foreign key/i.test(raw)) {
    return new Error('This supplier is linked to purchases and cannot be removed.');
  }
  if (/row-level security|permission|policy|42501/i.test(raw)) {
    return new Error('You do not have permission to change suppliers.');
  }
  if (/not authenticated|jwt|session/i.test(raw)) {
    return new Error('You must be signed in to manage suppliers.');
  }
  if (/pq:|plpgsql|context:/i.test(raw)) {
    if (typeof console !== 'undefined') console.error('[suppliers]', raw);
    return new Error('Unable to complete supplier request. Please try again.');
  }
  return new Error(raw);
}

function toListItem(row: SupplierRow): SupplierListItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List suppliers from public.suppliers.
 * Defaults to active-only (matches legacy Nest listSuppliers).
 */
export async function listSuppliers(options?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<SupplierListItem[]> {
  const supabase = createClient();

  let query = supabase
    .from('suppliers')
    .select('id, name, phone, email, address, notes, is_active, created_at, updated_at')
    .order('name', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const search = options?.search?.trim();
  if (search) {
    const safe = search.replace(/[%_,]/g, ' ').trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},address.ilike.${pattern}`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw mapSupplierError(error.message);
  return ((data ?? []) as SupplierRow[]).map(toListItem);
}

export async function createSupplier(input: CreateSupplierInput): Promise<SupplierListItem> {
  const name = input.name.trim();
  if (!name) throw new Error('Supplier name is required.');

  const supabase = createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select('id, name, phone, email, address, notes, is_active, created_at, updated_at')
    .single();

  if (error) throw mapSupplierError(error.message);
  return toListItem(data as SupplierRow);
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
): Promise<SupplierListItem> {
  if (!id.trim()) throw new Error('Supplier id is required.');

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('Supplier name is required.');
    payload.name = name;
  }
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.address !== undefined) payload.address = input.address?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  if (Object.keys(payload).length === 0) {
    throw new Error('No supplier changes to save.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', id)
    .select('id, name, phone, email, address, notes, is_active, created_at, updated_at')
    .single();

  if (error) throw mapSupplierError(error.message);
  return toListItem(data as SupplierRow);
}

/**
 * Soft activate/deactivate. Prefer this over hard delete so purchase history stays intact.
 */
export async function setSupplierActive(
  id: string,
  isActive: boolean,
): Promise<SupplierListItem> {
  return updateSupplier(id, { isActive });
}
