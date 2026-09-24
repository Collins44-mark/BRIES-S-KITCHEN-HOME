'use client';

import Link from 'next/link';
import type { DashboardSummary } from '@bries/types';
import { formatTzs } from '@/lib/utils';

export function TopDebtorsCard({ items }: { items: DashboardSummary['topDebtors'] }) {
  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">Top Debtors</h3>
        <Link href="/debts" className="view-all">
          View All
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No outstanding debts</p>
      ) : (
        <div className="space-y-2">
          {items.map((debtor) => (
            <div
              key={debtor.customerId}
              className="glass-row flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-4 shrink-0 text-center text-[12px] font-semibold text-slate-400">
                  {debtor.rank}
                </span>
                <p className="truncate text-[13px] font-semibold text-slate-900">{debtor.name}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-slate-900">
                {formatTzs(debtor.outstandingBalance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
