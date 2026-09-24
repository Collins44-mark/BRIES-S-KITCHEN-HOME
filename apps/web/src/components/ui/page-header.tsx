import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared page title block — optional trailing action (e.g. date filter). */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5 sm:pt-1">{action}</div> : null}
    </div>
  );
}
