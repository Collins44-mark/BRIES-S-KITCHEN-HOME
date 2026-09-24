'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { createExpense, listExpenses, type ExpenseListItem } from '@/lib/supabase/expenses';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
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
  const { preset, from, to } = useDateRange();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(params.get('new') === '1');

  const {
    data: expenses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['expenses', preset, from, to],
    queryFn: () => listExpenses({ preset, from, to }),
  });

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      toast.success('Expense recorded');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to record expense'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (createMutation.isPending) return;

    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') || '').trim();
    const category = String(fd.get('category') || '').trim();
    const amount = Number(fd.get('amount'));
    const paymentMethod = String(fd.get('paymentMethod') || 'CASH') as
      | 'CASH'
      | 'MPESA'
      | 'BANK';
    const description = String(fd.get('description') || '').trim() || null;

    if (!title) {
      toast.error('Title is required.');
      return;
    }
    if (!category) {
      toast.error('Category is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be greater than zero.');
      return;
    }
    if (!['CASH', 'MPESA', 'BANK'].includes(paymentMethod)) {
      toast.error('Choose a valid payment method.');
      return;
    }

    createMutation.mutate({
      title,
      category,
      amount,
      paymentMethod,
      description,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track operating costs for the selected period.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter />
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary h-10 px-4 text-sm sm:h-11"
          >
            {showForm ? 'Close' : 'Record Expense'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="title" required placeholder="Title" className="field" disabled={createMutation.isPending} />
          <select name="category" required className="field" disabled={createMutation.isPending}>
            <option value="Transport">Transport</option>
            <option value="Electricity">Electricity</option>
            <option value="Rent">Rent</option>
            <option value="Salary">Salary</option>
            <option value="Other">Other</option>
          </select>
          <input
            name="amount"
            required
            type="number"
            min={0.01}
            step="0.01"
            placeholder="Amount"
            className="field"
            disabled={createMutation.isPending}
          />
          <select name="paymentMethod" className="field" disabled={createMutation.isPending}>
            <option value="CASH">Cash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="BANK">Bank</option>
          </select>
          <input
            name="description"
            placeholder="Description"
            className="field md:col-span-2"
            disabled={createMutation.isPending}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"
          >
            {createMutation.isPending ? 'Saving…' : 'Save Expense'}
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="table-scroll">
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
            {isLoading && <TableLoadingRow colSpan={5} />}
            {isError && !isLoading && <TableErrorRow colSpan={5} onRetry={() => refetch()} />}
            {!isLoading && !isError && expenses.length === 0 && (
              <TableEmptyRow colSpan={5} message="No expenses yet" />
            )}
            {!isLoading &&
              !isError &&
              (expenses as ExpenseListItem[]).map((e) => (
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
