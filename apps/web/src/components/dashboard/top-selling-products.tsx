'use client';

import Link from 'next/link';
import type { DashboardSummary } from '@bries/types';
import { formatTzs } from '@/lib/utils';

export function TopSellingProducts({ items }: { items: DashboardSummary['topSellingProducts'] }) {
  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-slate-800 sm:text-[15px]">
          Top Selling Products
        </h3>
        <Link href="/reports" className="shrink-0 text-[12px] font-medium text-sky-600 hover:text-sky-700">
          View All →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No sales yet</p>
      ) : (
        <>
          {/* Mobile / tablet compact list */}
          <ul className="space-y-2.5 lg:hidden">
            {items.map((item) => (
              <li
                key={item.productId}
                className="rounded-xl border border-slate-100/80 bg-white/50 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      <span className="mr-1.5 text-slate-400">{item.rank}.</span>
                      {item.productName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.quantitySold} PCS</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-medium text-slate-700">{formatTzs(item.revenue)}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
                      {formatTzs(item.profit)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="table-scroll hidden lg:block">
            <table className="w-full min-w-[460px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200/60 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-2 font-medium">#</th>
                  <th className="pb-2.5 font-medium">Product</th>
                  <th className="pb-2.5 font-medium">Base Qty Sold</th>
                  <th className="pb-2.5 font-medium">Revenue (TZS)</th>
                  <th className="pb-2.5 font-medium">Profit (TZS)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-b border-slate-100/80 last:border-0">
                    <td className="py-2.5 pr-2 text-slate-400">{item.rank}</td>
                    <td className="py-2.5 font-medium text-slate-800">{item.productName}</td>
                    <td className="py-2.5 text-slate-600">{item.quantitySold} PCS</td>
                    <td className="py-2.5 text-slate-600">{formatTzs(item.revenue)}</td>
                    <td className="py-2.5 font-medium text-emerald-600">{formatTzs(item.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
