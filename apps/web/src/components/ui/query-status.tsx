'use client';

import { useLocale } from '@/contexts/locale-context';

export function TableLoadingRow({ colSpan, label }: { colSpan: number; label?: string }) {
  const { t } = useLocale();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
        {label ?? t('common.loading')}
      </td>
    </tr>
  );
}

export function TableEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-slate-400">
        {message}
      </td>
    </tr>
  );
}

export function TableErrorRow({
  colSpan,
  onRetry,
}: {
  colSpan: number;
  onRetry?: () => void;
}) {
  const { t } = useLocale();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center">
        <p className="text-sm text-slate-600">{t('common.unableLoad')}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
          >
            {t('common.retry')}
          </button>
        )}
      </td>
    </tr>
  );
}

export function InlineEmpty({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{message}</p>;
}

export function InlineError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-slate-600">{t('common.unableLoad')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
