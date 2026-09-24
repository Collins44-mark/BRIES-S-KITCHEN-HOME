'use client';

import Link from 'next/link';
import { ArrowRight, PackagePlus, Receipt, ShoppingCart, UserPlus } from 'lucide-react';

const ACTIONS = [
  {
    href: '/pos',
    label: 'New Sale (POS)',
    icon: ShoppingCart,
    primary: true,
  },
  {
    href: '/products?new=1',
    label: 'Add Product',
    icon: PackagePlus,
    primary: false,
  },
  {
    href: '/customers?new=1',
    label: 'Add Customer',
    icon: UserPlus,
    primary: false,
  },
  {
    href: '/expenses?new=1',
    label: 'Record Expense',
    icon: Receipt,
    primary: false,
  },
];

export function QuickActionsCard() {
  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-800">Quick Actions</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.primary
                  ? 'flex h-[52px] items-center justify-between gap-2 rounded-xl bg-brand-navy px-3 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_rgba(28,36,48,0.18)] transition hover:bg-slate-800'
                  : 'flex h-[52px] items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/55 px-3 text-[12.5px] font-medium text-slate-700 shadow-soft backdrop-blur-md transition hover:bg-white/80'
              }
            >
              <span className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${action.primary ? 'text-white' : 'text-sky-600'}`} />
                {action.label}
              </span>
              <ArrowRight
                className={`h-3.5 w-3.5 ${action.primary ? 'text-white/70' : 'text-slate-400'}`}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
