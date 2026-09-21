'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { customersApi } from '@/lib/services';
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
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list(search || undefined),
  });

  const { data: ledger } = useQuery({
    queryKey: ['customer-ledger', selectedId],
    queryFn: () => customersApi.ledger(selectedId!),
    enabled: !!selectedId,
  });

  const createCustomer = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      toast.success('Customer created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: () => toast.error('Failed to create customer'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createCustomer.mutate({
      name: String(fd.get('name')),
      phone: String(fd.get('phone') || '') || undefined,
      address: String(fd.get('address') || '') || undefined,
      notes: String(fd.get('notes') || '') || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">Registered customers and account balances.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm ? 'Close' : 'Add Customer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="name" required placeholder="Full name" className="field" />
          <input name="phone" placeholder="Phone e.g. 0712345678" className="field" />
          <input name="address" placeholder="Address" className="field" />
          <input name="notes" placeholder="Notes" className="field" />
          <button type="submit" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            Save Customer
          </button>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="glass-card overflow-hidden xl:col-span-3">
          <div className="border-b border-slate-100 p-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="field max-w-md"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Purchases</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-slate-50 hover:bg-white/60"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3">{formatTzs(c.totalPurchases)}</td>
                    <td className="px-4 py-3">{formatTzs(c.totalPaid)}</td>
                    <td className="px-4 py-3 font-medium text-rose-600">
                      {formatTzs(c.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-5 xl:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">Customer Ledger</h2>
          {!selectedId && (
            <p className="py-10 text-center text-sm text-slate-400">Select a customer to view ledger.</p>
          )}
          {ledger && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-400">Purchases</p>
                  <p className="mt-1 text-sm font-semibold">{formatTzs(ledger.account.totalPurchases)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-400">Paid</p>
                  <p className="mt-1 text-sm font-semibold">{formatTzs(ledger.account.totalPaid)}</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-[11px] text-rose-400">Balance</p>
                  <p className="mt-1 text-sm font-semibold text-rose-600">
                    {formatTzs(ledger.account.outstandingBalance)}
                  </p>
                </div>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-auto">
                {ledger.ledger.map(
                  (entry: {
                    id: string;
                    type: string;
                    amount: string;
                    balanceAfter: string;
                    createdAt: string;
                  }) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{entry.type}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            Number(entry.amount) >= 0 ? 'font-medium text-rose-600' : 'font-medium text-emerald-600'
                          }
                        >
                          {Number(entry.amount) >= 0 ? '+' : ''}
                          {formatTzs(Math.abs(Number(entry.amount)))}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Bal {formatTzs(entry.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
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
