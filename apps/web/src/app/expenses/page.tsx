'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { expensesApi } from '@/lib/services';
import { useDateRange } from '@/contexts/date-range-context';
import { formatTzs } from '@/lib/utils';

export default function ExpensesPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="glass-card h-40 animate-pulse bg-white/40" />}>
        <ExpensesView />
      </Suspense>
    </AppShell>
  );
}

function ExpensesView() {
  const params = useSearchParams();
  const { preset } = useDateRange();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(params.get('new') === '1');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', preset],
    queryFn: () => expensesApi.list(preset),
  });

  const createExpense = useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      toast.success('Expense recorded');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: () => toast.error('Failed to record expense'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createExpense.mutate({
      title: String(fd.get('title')),
      category: String(fd.get('category')),
      amount: Number(fd.get('amount')),
      paymentMethod: String(fd.get('paymentMethod') || 'CASH'),
      description: String(fd.get('description') || '') || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Track operating costs for the selected period.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm ? 'Close' : 'Record Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="title" required placeholder="Title" className="field" />
          <select name="category" required className="field">
            <option value="Transport">Transport</option>
            <option value="Electricity">Electricity</option>
            <option value="Rent">Rent</option>
            <option value="Salary">Salary</option>
            <option value="Other">Other</option>
          </select>
          <input name="amount" required type="number" min={0} placeholder="Amount" className="field" />
          <select name="paymentMethod" className="field">
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="BANK">Bank</option>
          </select>
          <input name="description" placeholder="Description" className="field md:col-span-2" />
          <button type="submit" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            Save Expense
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Date</th>
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
            {(expenses as Array<{
              id: string;
              title: string;
              category: string;
              amount: string;
              paymentMethod: string;
              expenseDate: string;
            }>).map((e) => (
              <tr key={e.id} className="border-t border-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{e.title}</td>
                <td className="px-4 py-3">{e.category}</td>
                <td className="px-4 py-3">{formatTzs(e.amount)}</td>
                <td className="px-4 py-3">{e.paymentMethod}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(e.expenseDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
