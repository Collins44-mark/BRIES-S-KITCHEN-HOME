'use client';

import Link from 'next/link';
import { PackagePlus, Receipt, ShoppingCart, UserPlus } from 'lucide-react';

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
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Quick Actions</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.primary
                  ? 'btn-primary flex h-[52px] items-center gap-2 px-3 text-[12.5px]'
                  : 'btn-secondary flex h-[52px] items-center gap-2 px-3 text-[12.5px]'
              }
            >
              <Icon className={`h-3.5 w-3.5 ${action.primary ? 'text-white' : 'text-slate-600'}`} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
