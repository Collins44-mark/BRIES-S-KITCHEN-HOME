import { createClient } from '@/lib/supabase/client';

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateCategoryInput = {
  name: string;
  description?: string | null;
  is_active?: boolean;
};

export type UpdateCategoryInput = {
  name?: string;
  description?: string | null;
  is_active?: boolean;
};

function mapCategoryError(message: string): Error {
  if (/duplicate key|unique/i.test(message)) {
    return new Error('A category with this name already exists.');
  }
  if (/row-level security|permission|policy/i.test(message)) {
    return new Error('You do not have permission to change categories.');
  }
  return new Error(message || 'Category request failed.');
}

export async function listCategories(options?: {
  includeInactive?: boolean;
}): Promise<CategoryRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('categories')
    .select('id, name, description, is_active, created_at, updated_at')
    .order('name', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw mapCategoryError(error.message);
  return (data ?? []) as CategoryRow[];
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryRow> {
  const supabase = createClient();
  const name = input.name.trim();
  if (name.length < 1) {
    throw new Error('Category name is required.');
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name,
      description: input.description?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select('id, name, description, is_active, created_at, updated_at')
    .single();

  if (error) throw mapCategoryError(error.message);
  return data as CategoryRow;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryRow> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1) throw new Error('Category name is required.');
    payload.name = name;
  }
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }
  if (input.is_active !== undefined) {
    payload.is_active = input.is_active;
  }

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('id, name, description, is_active, created_at, updated_at')
    .single();

  if (error) throw mapCategoryError(error.message);
  return data as CategoryRow;
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<CategoryRow> {
  return updateCategory(id, { is_active: isActive });
}
