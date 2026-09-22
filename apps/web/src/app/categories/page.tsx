'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import {
  createCategory,
  listCategories,
  setCategoryActive,
  updateCategory,
  type CategoryRow,
} from '@/lib/supabase/categories';

export default function CategoriesPage() {
  return (
    <AppShell>
      <CategoriesView />
    </AppShell>
  );
}

function CategoriesView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['categories', showInactive ? 'all' : 'active'],
    queryFn: () => listCategories({ includeInactive: showInactive }),
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success('Category created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string; description?: string | null }) =>
      updateCategory(id, input),
    onSuccess: () => {
      toast.success('Category updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update category'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setCategoryActive(id, isActive),
    onSuccess: (_data, vars) => {
      toast.success(vars.isActive ? 'Category activated' : 'Category deactivated');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update category'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: String(fd.get('name') || ''),
      description: String(fd.get('description') || '') || null,
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      name: String(fd.get('name') || ''),
      description: String(fd.get('description') || '') || null,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">Organize products into catalog groups.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show inactive
          </label>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
            className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
          >
            {showForm ? 'Close' : 'Add Category'}
          </button>
        </div>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="name" required placeholder="Category name" className="field" />
          <input name="description" placeholder="Description (optional)" className="field" />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Category'}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder="Category name"
            className="field"
          />
          <input
            name="description"
            defaultValue={editing.description ?? ''}
            placeholder="Description (optional)"
            className="field"
          />
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Category'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRow colSpan={4} />}
              {isError && !isLoading && <TableErrorRow colSpan={4} onRetry={() => refetch()} />}
              {!isLoading && !isError && categories.length === 0 && (
                <TableEmptyRow colSpan={4} message="No categories yet" />
              )}
              {!isLoading &&
                !isError &&
                categories.map((c) => (
                  <tr key={c.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={c.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                        {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setEditing(c);
                          }}
                          className="text-sm font-medium text-sky-600 hover:text-sky-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({ id: c.id, isActive: !c.is_active })
                          }
                          className="text-sm font-medium text-slate-600 hover:text-slate-800"
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        .field {
          height: 2.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.8);
          padding: 0 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .field:focus {
          border-color: #7dd3fc;
          box-shadow: 0 0 0 2px rgba(186, 230, 253, 0.8);
        }
      `}</style>
    </div>
  );
}
