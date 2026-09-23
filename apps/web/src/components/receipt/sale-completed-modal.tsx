'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Printer, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { SaleReceipt, printSaleReceipt } from '@/components/receipt/sale-receipt';
import { downloadSaleReceiptPdf } from '@/lib/receipt/download-receipt-pdf';
import { toSaleReceiptData, type ReceiptCashExtras } from '@/lib/receipt/types';
import { getSaleById } from '@/lib/supabase/sales-history';
import { formatTzs } from '@/lib/utils';

export type CompletedSaleContext = {
  saleId: string;
  cashReceived: string | null;
  changeDue: string | null;
};

type SaleCompletedModalProps = {
  completed: CompletedSaleContext;
  onNewSale: () => void;
  onClose?: () => void;
};

export function SaleCompletedModal({ completed, onNewSale, onClose }: SaleCompletedModalProps) {
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);

  const cashExtras: ReceiptCashExtras = useMemo(
    () => ({
      cashReceived: completed.cashReceived,
      changeDue: completed.changeDue,
    }),
    [completed.cashReceived, completed.changeDue],
  );

  const {
    data: sale,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['sale-receipt', completed.saleId],
    queryFn: () => getSaleById(completed.saleId),
    enabled: Boolean(completed.saleId),
    staleTime: 60_000,
  });

  const receiptData = useMemo(
    () => (sale ? toSaleReceiptData(sale, cashExtras) : null),
    [sale, cashExtras],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showReceiptPreview) setShowReceiptPreview(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReceiptPreview]);

  async function handleDownload() {
    if (!receiptData) return;
    setPdfBusy(true);
    try {
      await downloadSaleReceiptPdf(receiptData);
      toast.success('Receipt downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download receipt');
    } finally {
      setPdfBusy(false);
    }
  }

  function handlePrint() {
    if (!receiptData) return;
    setPrintBusy(true);
    try {
      printSaleReceipt(receiptData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open print dialog');
    } finally {
      setPrintBusy(false);
    }
  }

  const loadError = error instanceof Error ? error.message : 'Unable to load sale receipt.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-completed-title"
        className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Success</p>
            <h2 id="sale-completed-title" className="mt-1 text-2xl font-semibold text-slate-900">
              Sale Completed
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="mt-6 space-y-3">
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50/80 p-4 text-center">
            <p className="text-sm text-rose-700">{loadError}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isFetching ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {receiptData && !isLoading && (
          <>
            <div className="mt-5 space-y-2 rounded-xl border border-white/70 bg-white/55 p-4 text-sm shadow-soft">
              <SummaryRow label="Invoice" value={receiptData.invoiceNumber} emphasize />
              <SummaryRow
                label="Date"
                value={new Date(receiptData.soldAt).toLocaleString('en-TZ', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
              <SummaryRow label="Customer" value={receiptData.customerName} />
              <SummaryRow label="Total" value={formatTzs(receiptData.totalAmount)} emphasize />
              <SummaryRow label="Amount paid" value={formatTzs(receiptData.amountPaid)} />
              <SummaryRow label="Amount due" value={formatTzs(receiptData.amountDue)} />
              <SummaryRow label="Payment status" value={receiptData.paymentStatus} />
              {receiptData.cashReceived != null && Number(receiptData.cashReceived) > 0 && (
                <SummaryRow label="Cash received" value={formatTzs(receiptData.cashReceived)} />
              )}
              {receiptData.changeDue != null && Number(receiptData.changeDue) > 0 && (
                <SummaryRow
                  label="Change"
                  value={formatTzs(receiptData.changeDue)}
                  emphasize
                  positive
                />
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ActionButton
                icon={Eye}
                label="View Receipt"
                onClick={() => setShowReceiptPreview(true)}
              />
              <ActionButton
                icon={Download}
                label={pdfBusy ? 'Preparing…' : 'Download'}
                onClick={handleDownload}
                disabled={pdfBusy}
              />
              <ActionButton
                icon={Printer}
                label={printBusy ? 'Opening…' : 'Print'}
                onClick={handlePrint}
                disabled={printBusy}
              />
              <ActionButton
                icon={ShoppingCart}
                label="New Sale"
                onClick={onNewSale}
                primary
              />
            </div>
          </>
        )}
      </div>

      {showReceiptPreview && receiptData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="glass-card max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-800">Receipt preview</h3>
              <button
                type="button"
                onClick={() => setShowReceiptPreview(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close receipt preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SaleReceipt data={receiptData} layout="screen" className="rounded-xl p-4 shadow-soft" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={pdfBusy}
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={printBusy}
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptPreview(false)}
                className="rounded-xl bg-brand-navy px-3 py-2 text-sm font-medium text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize,
  positive,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          positive
            ? 'font-semibold text-emerald-700'
            : emphasize
              ? 'font-semibold text-slate-900'
              : 'font-medium text-slate-800'
        }
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'flex flex-col items-center justify-center gap-1.5 rounded-xl bg-brand-navy px-2 py-3 text-center text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(28,36,48,0.18)] disabled:opacity-60 sm:text-xs'
          : 'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/70 bg-white/55 px-2 py-3 text-center text-[11px] font-medium text-slate-700 shadow-soft backdrop-blur-md disabled:opacity-60 sm:text-xs'
      }
    >
      <Icon className={`h-4 w-4 ${primary ? 'text-white' : 'text-sky-600'}`} />
      {label}
    </button>
  );
}
