'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import {
  createSupplier,
  listSuppliers,
  setSupplierActive,
  updateSupplier,
  type SupplierListItem,
} from '@/lib/supabase/suppliers';

export default function SuppliersPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="glass-card h-40 animate-pulse bg-white/40" />}>
        <SuppliersView />
      </Suspense>
    </AppShell>
  );
}

function SuppliersView() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<SupplierListItem | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const {
    data: suppliers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['suppliers', search, includeInactive],
    queryFn: () =>
      listSuppliers({
        search: search || undefined,
        includeInactive,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      toast.success('Supplier created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create supplier'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      notes?: string | null;
    }) => updateSupplier(id, input),
    onSuccess: () => {
      toast.success('Supplier updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update supplier'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setSupplierActive(id, isActive),
    onSuccess: (_data, vars) => {
      toast.success(vars.isActive ? 'Supplier activated' : 'Supplier deactivated');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update supplier'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: String(fd.get('name')),
      phone: String(fd.get('phone') || '') || null,
      email: String(fd.get('email') || '') || null,
      address: String(fd.get('address') || '') || null,
      notes: String(fd.get('notes') || '') || null,
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      name: String(fd.get('name')),
      phone: String(fd.get('phone') || '') || null,
      email: String(fd.get('email') || '') || null,
      address: String(fd.get('address') || '') || null,
      notes: String(fd.get('notes') || '') || null,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">
            Manage suppliers used when receiving stock purchases.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm && !editing ? 'Close' : 'Add Supplier'}
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="name" required placeholder="Supplier name" className="field" />
          <input name="phone" placeholder="Phone" className="field" />
          <input name="email" type="email" placeholder="Email" className="field" />
          <input name="address" placeholder="Address" className="field" />
          <input name="notes" placeholder="Notes" className="field md:col-span-2" />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Supplier'}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder="Supplier name"
            className="field"
          />
          <input
            name="phone"
            defaultValue={editing.phone ?? ''}
            placeholder="Phone"
            className="field"
          />
          <input
            name="email"
            type="email"
            defaultValue={editing.email ?? ''}
            placeholder="Email"
            className="field"
          />
          <input
            name="address"
            defaultValue={editing.address ?? ''}
            placeholder="Address"
            className="field"
          />
          <input
            name="notes"
            defaultValue={editing.notes ?? ''}
            placeholder="Notes"
            className="field md:col-span-2"
          />
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Supplier'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show inactive
        </label>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableLoadingRow colSpan={6} />}
            {isError && !isLoading && <TableErrorRow colSpan={6} onRetry={() => refetch()} />}
            {!isLoading && !isError && suppliers.length === 0 && (
              <TableEmptyRow colSpan={6} message="No suppliers yet" />
            )}
            {!isLoading &&
              !isError &&
              suppliers.map((s) => (
                <tr key={s.id} className="border-t border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.isActive
                          ? 'inline-flex rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                      }
                    >
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowActionsMenu
                        actions={[
                          {
                            label: 'Edit',
                            onClick: () => {
                              setShowForm(false);
                              setEditing(s);
                            },
                          },
                          {
                            label: s.isActive ? 'Deactivate' : 'Activate',
                            disabled: toggleMutation.isPending,
                            tone: s.isActive ? 'danger' : 'default',
                            onClick: () =>
                              toggleMutation.mutate({ id: s.id, isActive: !s.isActive }),
                          },
                        ]}
                      />
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
        }
      `}</style>
    </div>
  );
}
