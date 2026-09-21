'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { debtsApi, paymentsApi } from '@/lib/services';
import { formatTzs } from '@/lib/utils';

export default function DebtsPage() {
  return (
    <AppShell>
      <DebtsView />
    </AppShell>
  );
}

function DebtsView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: debtsApi.summary,
  });
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');

  const recordPayment = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => {
      toast.success('Payment recorded');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: () => toast.error('Failed to record payment'),
  });

  function onPay(e: FormEvent) {
    e.preventDefault();
    if (!customerId || !amount) return;
    recordPayment.mutate({
      customerId,
      amount: Number(amount),
      method: 'CASH',
      notes: 'Debt repayment',
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Debts / Credit</h1>
        <p className="mt-1 text-sm text-slate-500">Customer ledger balances and repayments.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-500">Total Outstanding</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {data ? formatTzs(data.totalOutstanding) : '—'}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-500">Debtors</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{data?.debtorsCount ?? '—'}</p>
        </div>
      </div>

      <form onSubmit={onPay} className="glass-card grid gap-3 p-5 md:grid-cols-3">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
          required
        >
          <option value="">Select debtor</option>
          {(data?.debtors ?? []).map(
            (d: { customerId: string; name: string; outstandingBalance: string }) => (
              <option key={d.customerId} value={d.customerId}>
                {d.name} — {formatTzs(d.outstandingBalance)}
              </option>
            ),
          )}
        </select>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Payment amount"
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
          required
        />
        <button
          type="submit"
          className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Record Payment
        </button>
      </form>

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Purchases</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {(data?.debtors ?? []).map(
              (d: {
                rank: number;
                customerId: string;
                name: string;
                phone: string | null;
                totalPurchases: string;
                totalPaid: string;
                outstandingBalance: string;
              }) => (
                <tr key={d.customerId} className="border-t border-slate-50">
                  <td className="px-4 py-3 text-slate-400">{d.rank}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500">{d.phone ?? '—'}</td>
                  <td className="px-4 py-3">{formatTzs(d.totalPurchases)}</td>
                  <td className="px-4 py-3">{formatTzs(d.totalPaid)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">
                    {formatTzs(d.outstandingBalance)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
