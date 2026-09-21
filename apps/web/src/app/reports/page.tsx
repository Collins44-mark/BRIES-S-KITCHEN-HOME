'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { reportsApi } from '@/lib/services';
import { useDateRange } from '@/contexts/date-range-context';
import { formatTzs } from '@/lib/utils';

type ReportKey =
  | 'sales'
  | 'profit'
  | 'expenses'
  | 'inventory'
  | 'debts'
  | 'payments'
  | 'purchases';

const TABS: { key: ReportKey; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'profit', label: 'Profit' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'debts', label: 'Debts' },
  { key: 'payments', label: 'Payments' },
  { key: 'purchases', label: 'Purchases' },
];

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsView />
    </AppShell>
  );
}

function ReportsView() {
  const { preset } = useDateRange();
  const [tab, setTab] = useState<ReportKey>('sales');

  const query = useQuery({
    queryKey: ['reports', tab, preset],
    queryFn: async () => {
      switch (tab) {
        case 'sales':
          return reportsApi.sales(preset);
        case 'profit':
          return reportsApi.profit(preset);
        case 'expenses':
          return reportsApi.expenses(preset);
        case 'inventory':
          return reportsApi.inventory();
        case 'debts':
          return reportsApi.debts();
        case 'payments':
          return reportsApi.payments(preset);
        case 'purchases':
          return reportsApi.purchases(preset);
      }
    },
  });

  function exportCsv() {
    const rows = (query.data as { rows?: Array<Record<string, unknown>> })?.rows ?? [];
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replaceAll('"', '""')}"`).join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const data = query.data as {
    total?: string;
    revenue?: string;
    grossProfit?: string;
    costOfGoodsSold?: string;
    rows?: Array<Record<string, unknown>>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            View and export business reports for the selected period.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'rounded-xl bg-brand-navy px-3.5 py-2 text-sm font-medium text-white'
                : 'rounded-xl border border-white/70 bg-white/70 px-3.5 py-2 text-sm text-slate-600'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {(data?.total || data?.grossProfit) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {data.total && (
            <div className="glass-card p-5">
              <p className="text-sm text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-semibold">{formatTzs(data.total)}</p>
            </div>
          )}
          {data.revenue && (
            <div className="glass-card p-5">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="mt-2 text-2xl font-semibold">{formatTzs(data.revenue)}</p>
            </div>
          )}
          {data.grossProfit && (
            <div className="glass-card p-5">
              <p className="text-sm text-slate-500">Gross Profit</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                {formatTzs(data.grossProfit)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {query.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Loading report...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
                <tr>
                  {data?.rows?.[0] &&
                    Object.keys(data.rows[0]).map((key) => (
                      <th key={key} className="px-4 py-3 font-medium">
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-50">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="px-4 py-3 text-slate-700">
                        {String(value ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
