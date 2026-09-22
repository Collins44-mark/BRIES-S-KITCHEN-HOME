'use client';

export function TableLoadingRow({ colSpan, label = 'Loading...' }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
        {label}
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
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center">
        <p className="text-sm text-slate-600">Unable to load data. Please try again.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
          >
            Retry
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
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-slate-600">Unable to load data. Please try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      )}
    </div>
  );
}
