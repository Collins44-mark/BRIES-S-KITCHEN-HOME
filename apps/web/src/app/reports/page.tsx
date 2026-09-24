'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { InlineError } from '@/components/ui/query-status';
import {
  getDebtsReport,
  getExpensesReport,
  getInventoryReport,
  getPaymentsReport,
  getProfitReport,
  getPurchasesReport,
  getSalesReport,
} from '@/lib/supabase/reports';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { useDateRange } from '@/contexts/date-range-context';
import { formatTzs } from '@/lib/utils';
import { downloadReportPdf } from '@/lib/reports/download-report-pdf';
import {
  REPORT_COLUMNS,
  REPORT_TITLES,
  buildReportSummaries,
  formatReportCell,
  formatReportPeriodLabel,
  formatReportStatus,
  paymentStatusBadgeClass,
  type ReportKey,
} from '@/lib/reports/report-presentation';

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
  const { preset, from, to, label } = useDateRange();
  const [tab, setTab] = useState<ReportKey>('sales');
  const [exporting, setExporting] = useState(false);

  const query = useQuery({
    queryKey: ['reports', tab, preset, from, to],
    queryFn: async () => {
      const filters = { preset, from, to };
      switch (tab) {
        case 'sales':
          return getSalesReport(filters);
        case 'profit':
          return getProfitReport(filters);
        case 'expenses':
          return getExpensesReport(filters);
        case 'inventory':
          return getInventoryReport();
        case 'debts':
          return getDebtsReport();
        case 'payments':
          return getPaymentsReport(filters);
        case 'purchases':
          return getPurchasesReport(filters);
      }
    },
  });

  const data = query.data as {
    total?: string;
    revenue?: string;
    grossProfit?: string;
    totalProfit?: string;
    amountCollected?: string;
    costOfGoodsSold?: string;
    creditSales?: string;
    count?: number;
    rows?: Array<Record<string, unknown>>;
  };

  const rows = data?.rows ?? [];
  const columns = REPORT_COLUMNS[tab];
  const periodLabel = formatReportPeriodLabel({ tab, preset, label, from, to });
  const showTotals =
    data != null &&
    (data.total !== undefined || data.revenue !== undefined || data.grossProfit !== undefined);

  async function onExportPdf() {
    if (!query.data || query.isLoading || query.isError) {
      toast.error('Report data is not ready to export.');
      return;
    }
    setExporting(true);
    try {
      await downloadReportPdf({
        tab,
        periodLabel,
        summaries: buildReportSummaries(data ?? {}),
        rows,
      });
      toast.success(`${REPORT_TITLES[tab]} exported`);
    } catch {
      toast.error('Unable to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            View and export business reports for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter />
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exporting || query.isLoading || query.isError}
            className="btn-secondary inline-flex h-10 items-center gap-2 px-4 text-sm sm:h-11"
          >
            <FileText className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.85} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'btn-primary px-3.5 py-2 text-sm'
                : 'btn-secondary px-3.5 py-2 text-sm'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {showTotals && !query.isLoading && !query.isError && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {data.total !== undefined && (
            <div className="glass-card p-3 sm:p-4 lg:p-5">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total</p>
              <p className="kpi-value mt-1.5 sm:mt-2">{formatTzs(data.total)}</p>
            </div>
          )}
          {data.revenue !== undefined && (
            <div className="glass-card p-3 sm:p-4 lg:p-5">
              <p className="text-[11px] text-slate-500 sm:text-sm">Revenue</p>
              <p className="kpi-value mt-1.5 sm:mt-2">{formatTzs(data.revenue)}</p>
            </div>
          )}
          {data.grossProfit !== undefined && (
            <div className="glass-card col-span-2 p-3 sm:col-span-1 sm:p-4 lg:p-5">
              <p className="text-[11px] text-slate-500 sm:text-sm">Gross Profit</p>
              <p className="kpi-value mt-1.5 text-emerald-600 sm:mt-2">
                {formatTzs(data.grossProfit)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {query.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Loading report...</p>
        ) : query.isError ? (
          <InlineError onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No data available for this period
          </p>
        ) : (
          <div className="relative">
            <p className="border-b border-slate-100/80 px-4 py-2 text-[11px] text-slate-400 lg:hidden">
              Swipe sideways to see all columns
            </p>
            <div className="table-scroll border-t border-transparent">
              <table className="w-full min-w-[640px] text-left text-sm lg:min-w-[720px]">
                <thead className="sticky top-0 z-[1] bg-white/70 text-[11px] font-semibold tracking-wide text-slate-500 backdrop-blur-md">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="whitespace-nowrap px-3 py-3 sm:px-4">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100/70">
                      {columns.map((col) => {
                        const raw = row[col.key];
                        if (col.kind === 'status') {
                          return (
                            <td key={col.key} className="whitespace-nowrap px-3 py-3 sm:px-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm ${paymentStatusBadgeClass(raw)}`}
                              >
                                {formatReportStatus(raw)}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col.key}
                            className={`whitespace-nowrap px-3 py-3 text-slate-700 sm:px-4 ${
                              col.kind === 'money' ? 'font-medium text-slate-900' : ''
                            }`}
                          >
                            {formatReportCell(col.kind, raw)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
