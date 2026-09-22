'use client';

import Link from 'next/link';
import type { DashboardSummary } from '@bries/types';
import { formatTzs, initials } from '@/lib/utils';

const AVATAR_TONES = [
  'bg-violet-100/80 text-violet-700',
  'bg-sky-100/80 text-sky-700',
  'bg-emerald-100/80 text-emerald-700',
  'bg-amber-100/80 text-amber-700',
  'bg-rose-100/80 text-rose-700',
];

export function TopDebtorsCard({ items }: { items: DashboardSummary['topDebtors'] }) {
  return (
    <section className="glass-card flex h-full flex-col p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">Top Debtors</h3>
        <Link href="/debts" className="text-[12px] font-medium text-sky-600 hover:text-sky-700">
          View All →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No outstanding debts</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((debtor, index) => (
            <div key={debtor.customerId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-4 shrink-0 text-[12px] text-slate-400">{debtor.rank}</span>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
                >
                  {initials(debtor.name)}
                </div>
                <p className="truncate text-[13px] font-medium text-slate-800">{debtor.name}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-slate-800">
                {formatTzs(debtor.outstandingBalance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
