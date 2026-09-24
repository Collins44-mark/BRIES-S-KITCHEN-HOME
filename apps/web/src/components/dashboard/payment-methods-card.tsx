'use client';

import Link from 'next/link';
import { Banknote, Building2, Smartphone } from 'lucide-react';
import type { DashboardSummary } from '@bries/types';
import { GlassIcon } from '@/components/ui/glass-icon';
import { formatTzs } from '@/lib/utils';

/** Actual payment methods only — CREDIT is never a payment row. */
const META: Record<
  'CASH' | 'MPESA' | 'BANK',
  { label: string; icon: typeof Banknote; tone: 'green' | 'blue' }
> = {
  CASH: { label: 'Cash', icon: Banknote, tone: 'green' },
  MPESA: { label: 'M-Pesa', icon: Smartphone, tone: 'green' },
  BANK: { label: 'Bank', icon: Building2, tone: 'blue' },
};

export function PaymentMethodsCard({
  items,
}: {
  items: DashboardSummary['paymentMethods'];
}) {
  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">Payment Methods</h3>
        <Link href="/reports" className="text-[12px] font-medium text-sky-600 hover:text-sky-700">
          View All →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No payments yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            if (item.method === 'CREDIT') return null;
            const meta = META[item.method];
            if (!meta) return null;
            return (
              <div key={item.method} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <GlassIcon icon={meta.icon} tone={meta.tone} className="h-8 w-8 rounded-[10px]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{meta.label}</p>
                    <p className="text-[12px] font-semibold text-slate-700">{formatTzs(item.amount)}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-slate-500">{item.percent}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
