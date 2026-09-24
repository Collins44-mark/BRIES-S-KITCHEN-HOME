'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { useAuth } from '@/contexts/auth-context';
import {
  createCustomer,
  fetchCustomerAccountSummary,
  fetchCustomers,
  setCustomerActive,
  updateCustomer,
  type CustomerListItem,
} from '@/lib/supabase/customers';
import { formatTzs } from '@/lib/utils';

export default function CustomersPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="glass-card h-40 animate-pulse bg-white/40" />}>
        <CustomersView />
      </Suspense>
    </AppShell>
  );
}

function CustomersView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const canRecordPayment =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'CASHIER';
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeWalkIn, setIncludeWalkIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const {
    data: customers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['customers', search, includeInactive, includeWalkIn],
    queryFn: () =>
      fetchCustomers({
        search: search || undefined,
        includeInactive,
        includeWalkIn,
      }),
  });

  const {
    data: accountSummary,
    isLoading: ledgerLoading,
    isError: ledgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: ['customer-account', selectedId],
    queryFn: () => fetchCustomerAccountSummary(selectedId!),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      toast.success('Customer created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create customer'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
      notes?: string | null;
      isWalkIn?: boolean;
    }) => updateCustomer(id, input),
    onSuccess: () => {
      toast.success('Customer updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update customer'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setCustomerActive(id, isActive),
    onSuccess: (_data, vars) => {
      toast.success(vars.isActive ? 'Customer activated' : 'Customer deactivated');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update customer'),
  });

  function closeLedger() {
    setSelectedId(null);
    setSelectedName(null);
  }

  function openLedger(id: string, name: string) {
    setSelectedId(id);
    setSelectedName(name);
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: String(fd.get('name')),
      phone: String(fd.get('phone') || '') || null,
      address: String(fd.get('address') || '') || null,
      notes: String(fd.get('notes') || '') || null,
      isWalkIn: fd.get('isWalkIn') === 'on',
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
      address: String(fd.get('address') || '') || null,
      notes: String(fd.get('notes') || '') || null,
      isWalkIn: fd.get('isWalkIn') === 'on',
    });
  }

  useEffect(() => {
    if (!selectedId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setSelectedName(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Registered customers and account balances.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="min-h-11 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm && !editing ? 'Close' : 'Add Customer'}
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="name" required placeholder="Full name" className="field" />
          <input name="phone" placeholder="Phone e.g. 0712345678" className="field" />
          <input name="address" placeholder="Address" className="field" />
          <input name="notes" placeholder="Notes" className="field" />
          <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
            <input type="checkbox" name="isWalkIn" className="rounded border-slate-300" />
            Walk-in customer
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Customer'}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder="Full name"
            className="field"
          />
          <input
            name="phone"
            defaultValue={editing.phone ?? ''}
            placeholder="Phone e.g. 0712345678"
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
            className="field"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
            <input
              type="checkbox"
              name="isWalkIn"
              defaultChecked={editing.isWalkIn}
              className="rounded border-slate-300"
            />
            Walk-in customer
          </label>
          <div className="grid grid-cols-3 gap-2 md:col-span-2">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-[11px] text-slate-400">Purchases</p>
              <p className="mt-1 text-sm font-semibold">{formatTzs(editing.totalPurchases)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-[11px] text-slate-400">Paid</p>
              <p className="mt-1 text-sm font-semibold">{formatTzs(editing.totalPaid)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <p className="text-[11px] text-rose-400">Balance</p>
              <p className="mt-1 text-sm font-semibold text-rose-600">
                {formatTzs(editing.outstandingBalance)}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 md:col-span-2">
            Account balances are read-only and updated by sales and debt payments.
          </p>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Customer'}
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
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="field w-full max-w-full sm:max-w-md"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show inactive
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeWalkIn}
              onChange={(e) => setIncludeWalkIn(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show walk-in
          </label>
        </div>

        {/* Mobile card list */}
        <div className="divide-y divide-slate-50 lg:hidden">
          {isLoading && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
          )}
          {isError && !isLoading && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-600">Unable to load customers.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 min-h-11 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && customers.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No customers yet</p>
          )}
          {!isLoading &&
            !isError &&
            customers.map((c) => (
              <div key={c.id} className="px-4 py-3.5">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => openLedger(c.id, c.name)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {c.name}
                        {c.isWalkIn && (
                          <span className="ml-2 text-[11px] font-normal text-slate-400">
                            Walk-in
                          </span>
                        )}
                        {!c.isActive && (
                          <span className="ml-2 text-[11px] font-normal text-slate-400">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">{c.phone ?? '—'}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-rose-600">
                      {formatTzs(c.outstandingBalance)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <span>Purchases: {formatTzs(c.totalPurchases)}</span>
                    <span className="text-right">Paid: {formatTzs(c.totalPaid)}</span>
                  </div>
                </button>
                <div className="mt-2.5 flex flex-wrap gap-3">
                  {canRecordPayment && Number(c.outstandingBalance) > 0 ? (
                    <Link
                      href={`/debts?customer=${c.id}`}
                      className="min-h-10 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      Record Payment
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditing(c);
                    }}
                    className="min-h-10 text-sm font-medium text-sky-600 hover:text-sky-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={toggleMutation.isPending}
                    onClick={() =>
                      toggleMutation.mutate({ id: c.id, isActive: !c.isActive })
                    }
                    className="min-h-10 text-sm font-medium text-slate-600 hover:text-slate-800"
                  >
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Desktop / large tablet table */}
        <div className="table-scroll hidden lg:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Purchases</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRow colSpan={6} />}
              {isError && !isLoading && <TableErrorRow colSpan={6} onRetry={() => refetch()} />}
              {!isLoading && !isError && customers.length === 0 && (
                <TableEmptyRow colSpan={6} message="No customers yet" />
              )}
              {!isLoading &&
                !isError &&
                customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-50 hover:bg-white/60">
                    <td
                      className="cursor-pointer px-4 py-3 font-medium text-slate-800"
                      onClick={() => openLedger(c.id, c.name)}
                    >
                      {c.name}
                      {c.isWalkIn && (
                        <span className="ml-2 text-[11px] font-normal text-slate-400">Walk-in</span>
                      )}
                      {!c.isActive && (
                        <span className="ml-2 text-[11px] font-normal text-slate-400">Inactive</span>
                      )}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3 text-slate-500"
                      onClick={() => openLedger(c.id, c.name)}
                    >
                      {c.phone ?? '—'}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3"
                      onClick={() => openLedger(c.id, c.name)}
                    >
                      {formatTzs(c.totalPurchases)}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3"
                      onClick={() => openLedger(c.id, c.name)}
                    >
                      {formatTzs(c.totalPaid)}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3 font-medium text-rose-600"
                      onClick={() => openLedger(c.id, c.name)}
                    >
                      {formatTzs(c.outstandingBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canRecordPayment && Number(c.outstandingBalance) > 0 ? (
                          <Link
                            href={`/debts?customer=${c.id}`}
                            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            Record Payment
                          </Link>
                        ) : null}
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
                            toggleMutation.mutate({ id: c.id, isActive: !c.isActive })
                          }
                          className="text-sm font-medium text-slate-600 hover:text-slate-800"
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/40" onClick={closeLedger} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-800">Customer Ledger</h2>
                {selectedName && (
                  <p className="mt-0.5 truncate text-sm text-slate-500">{selectedName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeLedger}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close ledger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {ledgerLoading && (
                <p className="py-10 text-center text-sm text-slate-400">Loading ledger...</p>
              )}
              {ledgerError && !ledgerLoading && (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-600">Unable to load ledger. Please try again.</p>
                  <button
                    type="button"
                    onClick={() => refetchLedger()}
                    className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
                  >
                    Retry
                  </button>
                </div>
              )}
                  {accountSummary && !ledgerLoading && !ledgerError && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-400">Purchases</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatTzs(accountSummary.totalPurchases)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-400">Paid</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatTzs(accountSummary.totalPaid)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3">
                      <p className="text-[11px] text-rose-400">Balance</p>
                      <p className="mt-1 text-sm font-semibold text-rose-600">
                        {formatTzs(accountSummary.outstandingBalance)}
                      </p>
                    </div>
                  </div>
                  {canRecordPayment && Number(accountSummary.outstandingBalance) > 0 ? (
                    <Link
                      href={`/debts?customer=${selectedId}`}
                      className="flex h-11 items-center justify-center rounded-xl bg-brand-navy text-sm font-semibold text-white"
                    >
                      Record Payment
                    </Link>
                  ) : null}
                  <div className="max-h-[360px] space-y-2 overflow-auto">
                    <p className="py-6 text-center text-sm text-slate-400">No ledger entries yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
