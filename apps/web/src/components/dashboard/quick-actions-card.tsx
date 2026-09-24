'use client';

import Link from 'next/link';
import { PackagePlus, Receipt, ShoppingCart, UserPlus } from 'lucide-react';
import { GlassIcon } from '@/components/ui/glass-icon';

const ACTIONS = [
  {
    href: '/pos',
    label: 'New Sale (POS)',
    icon: ShoppingCart,
    primary: true,
    tone: 'slate' as const,
  },
  {
    href: '/products?new=1',
    label: 'Add Product',
    icon: PackagePlus,
    primary: false,
    tone: 'blue' as const,
  },
  {
    href: '/customers?new=1',
    label: 'Add Customer',
    icon: UserPlus,
    primary: false,
    tone: 'purple' as const,
  },
  {
    href: '/expenses?new=1',
    label: 'Record Expense',
    icon: Receipt,
    primary: false,
    tone: 'green' as const,
  },
];

export function QuickActionsCard() {
  return (
    <section className="glass-card flex h-full flex-col p-3.5 sm:p-[18px]">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Quick Actions</h3>
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
                {action.label}
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
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
