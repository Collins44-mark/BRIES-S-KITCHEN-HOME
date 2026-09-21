'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, ShoppingCart, Users, Wallet } from 'lucide-react';
import { dashboardApi } from '@/lib/services';
import { useDateRange } from '@/contexts/date-range-context';
import { formatTzs } from '@/lib/utils';
import { KpiCard } from '@/components/ui/kpi-card';
import { TopSellingProducts } from './top-selling-products';
import { PaymentMethodsCard } from './payment-methods-card';
import { TopDebtorsCard } from './top-debtors-card';
import { QuickActionsCard } from './quick-actions-card';

export function DashboardView() {
  const { preset, from, to } = useDateRange();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary', preset, from, to],
    queryFn: () => dashboardApi.summary(preset, from, to),
  });

  if (isLoading) {
    return (
      <div className="space-y-[18px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-[118px] animate-pulse" />
          ))}
        </div>
        <div className="grid gap-[18px] xl:grid-cols-5">
          <div className="glass-card h-64 animate-pulse xl:col-span-3" />
          <div className="glass-card h-64 animate-pulse xl:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-sm text-slate-600">Unable to load dashboard data.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const compareLabel = preset === 'today' ? 'yesterday' : 'previous period';
  const salesHint =
    data.salesChangePercent === null
      ? undefined
      : `${data.salesChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.salesChangePercent)}% from ${compareLabel}`;
  const profitHint =
    data.profitChangePercent === null
      ? undefined
      : `${data.profitChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.profitChangePercent)}% from ${compareLabel}`;

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Here&apos;s your business overview for today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Sales"
          value={formatTzs(data.totalSales)}
          hint={salesHint}
          hintPositive={data.salesChangePercent !== null ? data.salesChangePercent >= 0 : undefined}
          icon={ShoppingCart}
          tone="green"
        />
        <KpiCard
          label="Total Profit"
          value={formatTzs(data.totalProfit)}
          hint={profitHint}
          hintPositive={data.profitChangePercent !== null ? data.profitChangePercent >= 0 : undefined}
          icon={BarChart3}
          tone="purple"
        />
        <KpiCard
          label="Amount Collected"
          value={formatTzs(data.amountCollected)}
          hint={`${data.collectedPercentOfSales}% of sales`}
          icon={Wallet}
          tone="blue"
        />
        <KpiCard
          label="Outstanding Debts"
          value={formatTzs(data.outstandingDebts)}
          hint={`${data.debtorsCount} customers`}
          icon={Users}
          tone="red"
        />
      </div>

      <div className="grid gap-[18px] xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TopSellingProducts items={data.topSellingProducts} />
        </div>
        <div className="xl:col-span-2">
          <PaymentMethodsCard items={data.paymentMethods} />
        </div>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TopDebtorsCard items={data.topDebtors} />
        </div>
        <div className="xl:col-span-2">
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
}
