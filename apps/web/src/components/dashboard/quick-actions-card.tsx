'use client';

import Link from 'next/link';
import { PackagePlus, Receipt, ShoppingCart, UserPlus } from 'lucide-react';
import { GlassIcon } from '@/components/ui/glass-icon';
import { useLocale } from '@/contexts/locale-context';

const ACTIONS = [
  {
    href: '/pos',
    labelKey: 'dashboard.newSale',
    icon: ShoppingCart,
    primary: true,
    tone: 'slate' as const,
  },
  {
    href: '/products?new=1',
    labelKey: 'dashboard.addProduct',
    icon: PackagePlus,
    primary: false,
    tone: 'blue' as const,
  },
  {
    href: '/customers?new=1',
    labelKey: 'dashboard.addCustomer',
    icon: UserPlus,
    primary: false,
    tone: 'purple' as const,
  },
  {
    href: '/expenses?new=1',
    labelKey: 'dashboard.recordExpense',
    icon: Receipt,
    primary: false,
    tone: 'green' as const,
  },
];

export function QuickActionsCard() {
  const { t } = useLocale();

  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">{t('dashboard.quickActions')}</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((action) => {
          if (action.primary) {
            return (
              <Link
                key={action.href}
                href={action.href}
                className="btn-primary flex h-[52px] items-center gap-2.5 px-3 text-[12.5px]"
              >
                <action.icon className="h-4 w-4 text-white" strokeWidth={1.9} />
                {t(action.labelKey)}
              </Link>
            );
          }
          return (
            <Link
              key={action.href}
              href={action.href}
              className="btn-secondary flex h-[52px] items-center gap-2.5 px-3 text-[12.5px]"
            >
              <GlassIcon
                icon={action.icon}
                tone={action.tone}
                className="!h-8 !w-8 !rounded-[10px]"
              />
              {t(action.labelKey)}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
