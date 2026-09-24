'use client';

import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useLocale } from '@/contexts/locale-context';
import { cn } from '@/lib/utils';

export type RowAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Destructive presentation for Deactivate / Delete / Remove. */
  tone?: 'default' | 'danger';
};

type RowActionsMenuProps = {
  actions: Array<RowAction | false | null | undefined>;
  align?: 'start' | 'center' | 'end';
  className?: string;
};

/**
 * Compact glass ⋯ trigger + frosted contextual menu.
 * Presentation only — callers own handlers and permissions.
 */
export function RowActionsMenu({
  actions,
  align = 'end',
  className,
}: RowActionsMenuProps) {
  const { t } = useLocale();
  const items = actions.filter((a): a is RowAction => Boolean(a));
  if (items.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('common.openActions')}
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            'border border-white/80 bg-white/55 text-slate-700',
            'shadow-[0_4px_14px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.9)]',
            'backdrop-blur-md transition',
            'hover:bg-white/75 hover:text-slate-900',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=open]:bg-white/80 data-[state=open]:text-slate-900',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-[200] min-w-[168px] max-w-[min(210px,calc(100vw-1.5rem))] overflow-hidden rounded-[16px]',
            'border border-white/85 bg-[rgba(255,255,255,0.92)] p-1.5',
            'shadow-[0_18px_40px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]',
            'backdrop-blur-[22px] saturate-[140%]',
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {items.map((action) => {
            const itemClass = cn(
              'flex min-h-[42px] w-full cursor-pointer items-center rounded-[12px] px-3 text-left text-[13.5px] font-medium outline-none transition',
              'data-[highlighted]:bg-slate-100/80',
              'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
              action.tone === 'danger'
                ? 'text-rose-600 data-[highlighted]:bg-rose-50/90 data-[highlighted]:text-rose-700'
                : 'text-slate-800 data-[highlighted]:text-slate-900',
            );

            if (action.href) {
              return (
                <DropdownMenu.Item key={action.label} asChild disabled={action.disabled}>
                  <Link
                    href={action.href}
                    className={itemClass}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {action.label}
                  </Link>
                </DropdownMenu.Item>
              );
            }

            return (
              <DropdownMenu.Item
                key={action.label}
                disabled={action.disabled}
                className={itemClass}
                onSelect={() => {
                  if (action.disabled) return;
                  action.onClick?.();
                }}
              >
                {action.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
