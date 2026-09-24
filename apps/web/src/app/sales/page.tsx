'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download, Printer, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { printSaleReceipt } from '@/components/receipt/sale-receipt';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { PageHeader } from '@/components/ui/page-header';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { useAuth } from '@/contexts/auth-context';
import { useDateRange } from '@/contexts/date-range-context';
import { downloadSaleReceiptPdf } from '@/lib/receipt/download-receipt-pdf';
import { toSaleReceiptData } from '@/lib/receipt/types';
import {
  getSaleById,
  listSales,
  formatSaleItemBaseHint,
  formatSaleItemQuantity,
  type SaleDetail,
  type SaleListItem,
  type SalePaymentStatus,
  type SaleStatus,
} from '@/lib/supabase/sales-history';
import { formatTzs } from '@/lib/utils';

export default function SalesPage() {
  return (
    <AppShell>
      <SalesView />
    </AppShell>
  );
}

function paymentBadgeClass(status: SalePaymentStatus): string {
  if (status === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIAL') return 'bg-amber-50 text-amber-700';
  if (status === 'PENDING') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function saleStatusBadgeClass(status: SaleStatus): string {
  if (status === 'COMPLETED') return 'bg-sky-50 text-sky-700';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600';
  if (status === 'REFUNDED') return 'bg-violet-50 text-violet-700';
  return 'bg-slate-100 text-slate-600';
}

function SalesView() {
  const { user } = useAuth();
  const { preset, from, to, label } = useDateRange();
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<SalePaymentStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const showCostProfit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canRecordPayment =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'CASHIER';

  const {
    data: sales = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['sales-history', preset, from, to, search, paymentStatus],
    queryFn: () =>
      listSales({
        preset,
        from,
        to,
        search: search || undefined,
        paymentStatus,
      }),
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['sale-detail', selectedId],
    queryFn: () => getSaleById(selectedId!),
    enabled: !!selectedId,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales History"
        subtitle={`Completed sales for ${label.toLowerCase()}. Totals come from the database.`}
        action={<DateRangeFilter />}
      />

      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer, or cashier..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pl-10 pr-3 text-sm outline-none focus:border-sky-300"
          />
        </div>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as SalePaymentStatus | 'ALL')}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
        >
          <option value="ALL">All payment statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableLoadingRow colSpan={8} />}
            {isError && !isLoading && <TableErrorRow colSpan={8} onRetry={() => refetch()} />}
            {!isLoading && !isError && sales.length === 0 && (
              <TableEmptyRow colSpan={8} message="No sales for this period" />
            )}
            {!isLoading &&
              !isError &&
              sales.map((sale: SaleListItem) => (
                <tr
                  key={sale.id}
                  className="cursor-pointer border-t border-slate-50 transition hover:bg-white/70"
                  onClick={() => setSelectedId(sale.id)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{sale.invoiceNumber}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {sale.customerName ?? 'Walk-in Customer'}
                    {sale.customerPhone ? (
                      <span className="mt-0.5 block text-xs text-slate-400">{sale.customerPhone}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{formatTzs(sale.totalAmount)}</td>
                  <td className="px-4 py-3">{formatTzs(sale.amountPaid)}</td>
                  <td className="px-4 py-3">{formatTzs(sale.amountDue)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(sale.paymentStatus)}`}
                    >
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sale.cashierName}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(sale.soldAt).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>

      {selectedId && (
        <SaleDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          errorMessage={
            detailErrorObj instanceof Error ? detailErrorObj.message : 'Unable to load sale detail.'
          }
          showCostProfit={showCostProfit}
          canRecordPayment={canRecordPayment}
          onBack={() => setSelectedId(null)}
          onRetry={() => refetchDetail()}
        />
      )}
    </div>
  );
}

function SaleDetailModal({
  detail,
  loading,
  error,
  errorMessage,
  showCostProfit,
  canRecordPayment,
  onBack,
  onRetry,
}: {
  detail: SaleDetail | undefined;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  showCostProfit: boolean;
  canRecordPayment: boolean;
  onBack: () => void;
  onRetry: () => void;
}) {
  const itemColSpan = showCostProfit ? 8 : 6;
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);

  const showRecordPayment =
    canRecordPayment &&
    detail != null &&
    detail.status === 'COMPLETED' &&
    detail.customerId != null &&
    Number(detail.amountDue) > 0;

  /** Historical reprint: no POS-session cashReceived/changeDue — omit those lines. */
  async function handleDownloadPdf() {
    if (!detail) return;
    setPdfBusy(true);
    try {
      await downloadSaleReceiptPdf(toSaleReceiptData(detail));
      toast.success('Receipt downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download receipt');
    } finally {
      setPdfBusy(false);
    }
  }

  function handlePrintReceipt() {
    if (!detail) return;
    setPrintBusy(true);
    try {
      printSaleReceipt(toSaleReceiptData(detail), 'a4');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open print dialog');
    } finally {
      setPrintBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-2 sm:items-center sm:p-4">
      <div
        className="glass-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sales
            </button>
            <h2 id="sale-detail-title" className="truncate text-lg font-semibold text-slate-900">
              {detail?.invoiceNumber ?? (loading ? 'Loading sale…' : 'Sale detail')}
            </h2>
            {detail ? (
              <p className="mt-1 text-sm text-slate-500">
                {new Date(detail.soldAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          {loading && (
            <div className="space-y-3 py-6">
              <div className="h-20 animate-pulse rounded-xl bg-white/50" />
              <div className="h-32 animate-pulse rounded-xl bg-white/50" />
              <div className="h-24 animate-pulse rounded-xl bg-white/50" />
            </div>
          )}

          {error && !loading && (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600">{errorMessage}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
                >
                  Back to Sales
                </button>
              </div>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="space-y-6">
              {/* Header meta */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Customer</p>
                  {detail.customerId ? (
                    <>
                      <p className="mt-1 font-medium text-slate-900">{detail.customerName}</p>
                      {detail.customerPhone ? (
                        <p className="mt-0.5 text-sm text-slate-500">{detail.customerPhone}</p>
                      ) : null}
                      {detail.customerEmail ? (
                        <p className="mt-0.5 text-sm text-slate-500">{detail.customerEmail}</p>
                      ) : null}
                      {detail.customerOutstandingBalance != null ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Account balance:{' '}
                          <span className="font-semibold text-rose-600">
                            {formatTzs(detail.customerOutstandingBalance)}
                          </span>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 font-medium text-slate-900">Walk-in Customer</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Sale info</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Cashier: <span className="font-medium text-slate-900">{detail.cashierName}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${saleStatusBadgeClass(detail.status)}`}
                    >
                      {detail.status}
                    </span>
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(detail.paymentStatus)}`}
                    >
                      {detail.paymentStatus}
                    </span>
                  </div>
                  {detail.notes ? (
                    <p className="mt-2 text-sm text-slate-500">Notes: {detail.notes}</p>
                  ) : null}
                </div>
              </div>

              {/* Line items */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Items</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white/60">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Product</th>
                        <th className="px-3 py-2.5 font-medium">Qty</th>
                        <th className="px-3 py-2.5 font-medium">Unit price</th>
                        <th className="px-3 py-2.5 font-medium">Subtotal</th>
                        <th className="px-3 py-2.5 font-medium">Discount</th>
                        <th className="px-3 py-2.5 font-medium">Line total</th>
                        {showCostProfit ? (
                          <>
                            <th className="px-3 py-2.5 font-medium">Cost</th>
                            <th className="px-3 py-2.5 font-medium">Profit</th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.length === 0 ? (
                        <tr>
                          <td colSpan={itemColSpan} className="px-3 py-6 text-center text-slate-400">
                            No line items
                          </td>
                        </tr>
                      ) : (
                        detail.items.map((item) => {
                          const qtyLabel = formatSaleItemQuantity(item);
                          const baseHint = formatSaleItemBaseHint(item);
                          return (
                          <tr key={item.id} className="border-t border-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {item.productName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              <span className="block">{qtyLabel}</span>
                              {baseHint ? (
                                <span className="block text-[11px] text-slate-400">{baseHint}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {formatTzs(item.unitPrice)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {formatTzs(item.lineSubtotal)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {formatTzs(item.discountAmount)}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {formatTzs(item.lineTotal)}
                            </td>
                            {showCostProfit ? (
                              <>
                                <td className="px-3 py-2.5 text-slate-500">
                                  {formatTzs(item.lineCost)}
                                </td>
                                <td className="px-3 py-2.5 text-emerald-600">
                                  {formatTzs(item.lineProfit)}
                                </td>
                              </>
                            ) : null}
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial summary — stored sales.* values only */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Financial summary</h3>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatTzs(detail.subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>
                      Discount
                      {detail.discountType !== 'NONE' ? ` (${detail.discountType})` : ''}
                    </span>
                    <span>−{formatTzs(detail.discountAmount)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{formatTzs(detail.totalAmount)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>Amount paid</span>
                    <span>{formatTzs(detail.amountPaid)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>Amount due</span>
                    <span
                      className={
                        Number(detail.amountDue) > 0 ? 'font-semibold text-rose-600' : undefined
                      }
                    >
                      {formatTzs(detail.amountDue)}
                    </span>
                  </div>
                  {showCostProfit ? (
                    <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-emerald-700">
                      <span>Total profit</span>
                      <span className="font-semibold">{formatTzs(detail.totalProfit)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Payments — empty list is valid, not an error */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Payments</h3>
                {detail.payments.length === 0 ? (
                  <p className="rounded-xl border border-slate-100 bg-white/60 px-4 py-5 text-center text-sm text-slate-400">
                    No payments recorded
                    {Number(detail.amountDue) > 0
                      ? ` · ${formatTzs(detail.amountDue)} outstanding on this sale`
                      : ''}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{p.method}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(p.paidAt).toLocaleString()}
                            {p.reference ? ` · Ref: ${p.reference}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 font-medium text-slate-900">{formatTzs(p.amount)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {Number(detail.amountDue) > 0 && detail.payments.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Outstanding on this sale: {formatTzs(detail.amountDue)} (not recorded as a
                    CREDIT payment)
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Close
                </button>
                {showRecordPayment ? (
                  <Link
                    href={`/debts?sale=${detail.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800"
                  >
                    Record Payment
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy || printBusy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {pdfBusy ? 'Downloading…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  disabled={pdfBusy || printBusy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  {printBusy ? 'Opening…' : 'Print Receipt'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
