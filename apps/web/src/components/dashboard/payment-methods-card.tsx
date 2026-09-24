'use client';

import Link from 'next/link';
import { Banknote, Building2, Smartphone } from 'lucide-react';
import type { DashboardSummary } from '@bries/types';
import { GlassIcon } from '@/components/ui/glass-icon';
import { useLocale } from '@/contexts/locale-context';
import { paymentMethodKey } from '@/lib/i18n/dictionaries';
import { formatTzs } from '@/lib/utils';

/** Actual payment methods only — CREDIT is never a payment row. */
const META: Record<
  'CASH' | 'MPESA' | 'BANK',
  { icon: typeof Banknote; tone: 'green' | 'blue' | 'purple' }
> = {
  CASH: { icon: Banknote, tone: 'green' },
  MPESA: { icon: Smartphone, tone: 'blue' },
  BANK: { icon: Building2, tone: 'purple' },
};

export function PaymentMethodsCard({
  items,
}: {
  items: DashboardSummary['paymentMethods'];
}) {
  const { t } = useLocale();

  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">{t('dashboard.paymentMethods')}</h3>
        <Link href="/reports" className="view-all">
          {t('common.viewAll')}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('common.noDataPeriod')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            if (item.method === 'CREDIT') return null;
            const meta = META[item.method];
            if (!meta) return null;
            const labelKey = paymentMethodKey(item.method);
            return (
              <div
                key={item.method}
                className="glass-row flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <GlassIcon icon={meta.icon} tone={meta.tone} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {t(labelKey)}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-slate-600">
                      {formatTzs(item.amount)}
                    </p>
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
