'use client';

import Link from 'next/link';
import type { DashboardSummary } from '@bries/types';
import { formatTzs } from '@/lib/utils';

export function TopSellingProducts({ items }: { items: DashboardSummary['topSellingProducts'] }) {
  return (
    <section className="glass-card flex h-full flex-col p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">Top Selling Products</h3>
        <Link href="/reports" className="text-[12px] font-medium text-sky-600 hover:text-sky-700">
          View All →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No sales yet</p>
      ) : (
        <div className="overflow-x-auto">
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
                  <td className="py-2.5 text-slate-600">
                    {item.quantitySold} PCS
                  </td>
                  <td className="py-2.5 text-slate-600">{formatTzs(item.revenue)}</td>
                  <td className="py-2.5 font-medium text-emerald-600">{formatTzs(item.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
