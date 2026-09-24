'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { statusKey } from '@/lib/i18n/dictionaries';
import {
  getCustomerDebtDetails,
  listDebtors,
  recordDebtPayment,
  type CustomerDebtDetails,
  type DebtorListItem,
  type DebtPaymentMethod,
  type OutstandingSale,
} from '@/lib/supabase/debts';
import { getSaleById } from '@/lib/supabase/sales-history';
import { formatTzs } from '@/lib/utils';

export default function DebtsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="glass-card h-40 animate-pulse bg-white/40" />}>
        <DebtsView />
      </Suspense>
    </AppShell>
  );
}

function labelStatus(status: string, t: (key: string) => string) {
  const key = statusKey(status);
  return key ? t(key) : status.replaceAll('_', ' ');
}

function DebtsView() {
  const { t } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const canRecordPayment =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'CASHIER';

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payingSale, setPayingSale] = useState<OutstandingSale | null>(null);
  const [deepLinkSaleId, setDeepLinkSaleId] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  // Deep-link: /debts?customer=<id> and/or /debts?sale=<id>
  useEffect(() => {
    if (deepLinkHandled) return;
    const customerParam = searchParams.get('customer')?.trim() || null;
    const saleParam = searchParams.get('sale')?.trim() || null;
    if (!customerParam && !saleParam) {
      setDeepLinkHandled(true);
      return;
    }

    let cancelled = false;

    async function applyDeepLink() {
      try {
        if (saleParam) {
          const sale = await getSaleById(saleParam);
          if (cancelled) return;
          if (sale.customerId) {
            setSelectedId(sale.customerId);
            setDeepLinkSaleId(sale.id);
          } else {
            toast.error(t('common.somethingWrong'));
          }
        } else if (customerParam) {
          setSelectedId(customerParam);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('common.unableLoad'));
        }
      } finally {
        if (!cancelled) setDeepLinkHandled(true);
      }
    }

    void applyDeepLink();
    return () => {
      cancelled = true;
    };
  }, [searchParams, deepLinkHandled, t]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    error,
  } = useQuery({
    queryKey: ['debts', search],
    queryFn: () => listDebtors({ search: search || undefined }),
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['debt-detail', selectedId],
    queryFn: () => getCustomerDebtDetails(selectedId!),
    enabled: !!selectedId,
  });

  // After detail loads from a sale deep-link, open the payment form for that sale.
  useEffect(() => {
    if (!deepLinkSaleId || !detail) return;
    const match = detail.outstandingSales.find((s) => s.id === deepLinkSaleId);
    if (!canRecordPayment) {
      toast.error(t('common.somethingWrong'));
    } else if (match) {
      setPayingSale(match);
    } else {
      toast.error(t('debts.noDebts'));
    }
    setDeepLinkSaleId(null);
  }, [deepLinkSaleId, detail, canRecordPayment, t]);

  const payMutation = useMutation({
    mutationFn: recordDebtPayment,
    onSuccess: () => {
      toast.success(t('common.saved'));
      setPayingSale(null);
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      queryClient.invalidateQueries({ queryKey: ['sale-detail'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  const debtors = data?.debtors ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t('debts.title')}</h1>
        <p className="page-subtitle">{t('debts.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
        <div className="glass-card p-3 sm:p-4 lg:p-5">
          <p className="text-[11px] text-slate-500 sm:text-sm">{t('debts.totalOutstanding')}</p>
          <p className="kpi-value mt-1.5 text-rose-600 sm:mt-2">
            {isLoading ? '—' : formatTzs(data?.totalOutstanding ?? '0')}
          </p>
        </div>
        <div className="glass-card p-3 sm:p-4 lg:p-5">
          <p className="text-[11px] text-slate-500 sm:text-sm">{t('debts.debtors')}</p>
          <p className="kpi-value mt-1.5 text-slate-900 sm:mt-2">
            {isLoading ? '—' : (data?.debtorsCount ?? 0)}
          </p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('debts.search')}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pl-10 pr-3 text-sm outline-none focus:border-sky-300"
          />
        </div>
      </div>

      {isError && !isLoading && (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-slate-600">
            {error instanceof Error ? error.message : t('common.unableLoad')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
<th className="px-4 py-3">{t('common.customer')}</th>
<th className="px-4 py-3">{t('common.phone')}</th>
<th className="px-4 py-3">{t('customers.purchases')}</th>
<th className="px-4 py-3">{t('customers.paid')}</th>
<th className="px-4 py-3">{t('debts.outstanding')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableLoadingRow colSpan={6} />}
            {isError && !isLoading && <TableErrorRow colSpan={6} onRetry={() => refetch()} />}
            {!isLoading && !isError && debtors.length === 0 && (
              <TableEmptyRow colSpan={6} message={t('debts.noDebts')} />
            )}
            {!isLoading &&
              !isError &&
              debtors.map((d: DebtorListItem) => (
                <tr
                  key={d.customerId}
                  className="cursor-pointer border-t border-slate-50 transition hover:bg-white/70"
                  onClick={() => setSelectedId(d.customerId)}
                >
                  <td className="px-4 py-3 text-slate-400">{d.rank}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500">{d.phone ?? '—'}</td>
                  <td className="px-4 py-3">{formatTzs(d.totalPurchases)}</td>
                  <td className="px-4 py-3">{formatTzs(d.totalPaid)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">
                    {formatTzs(d.outstandingBalance)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>

      {selectedId && (
        <DebtDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          errorMessage={
            detailErrorObj instanceof Error
              ? detailErrorObj.message
              : t('debts.loadDetailError')
          }
          canRecordPayment={canRecordPayment}
          onBack={() => {
            setPayingSale(null);
            setSelectedId(null);
          }}
          onRetry={() => refetchDetail()}
          onPaySale={(sale) => setPayingSale(sale)}
        />
      )}

      {payingSale && selectedId && detail && canRecordPayment && (
        <DebtPaymentModal
          customerId={selectedId}
          customerName={detail.name}
          sale={payingSale}
          isPending={payMutation.isPending}
          onClose={() => {
            if (!payMutation.isPending) setPayingSale(null);
          }}
          onSubmit={(input) => payMutation.mutate(input)}
        />
      )}
    </div>
  );
}

function DebtDetailModal({
  detail,
  loading,
  error,
  errorMessage,
  canRecordPayment,
  onBack,
  onRetry,
  onPaySale,
}: {
  detail: CustomerDebtDetails | undefined;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  canRecordPayment: boolean;
  onBack: () => void;
  onRetry: () => void;
  onPaySale: (sale: OutstandingSale) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center sm:p-4">
      <div
        className="glass-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-detail-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </button>
            <h2 id="debt-detail-title" className="truncate text-lg font-semibold text-slate-900">
              {detail?.name ?? (loading ? t('common.loading') : t('debts.debtorDetails'))}
            </h2>
            {detail?.phone ? <p className="page-subtitle">{detail.phone}</p> : null}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          {loading && (
            <div className="space-y-3 py-6">
              <div className="h-24 animate-pulse rounded-xl bg-white/50" />
              <div className="h-32 animate-pulse rounded-xl bg-white/50" />
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
                  {t('common.retry')}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
                >
                  {t('common.back')}
                </button>
              </div>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase text-slate-400">{t('customers.purchases')}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatTzs(detail.totalPurchases)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase text-slate-400">{t('customers.paid')}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatTzs(detail.totalPaid)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase text-slate-400">{t('debts.outstanding')}</p>
                  <p className="mt-1 text-lg font-semibold text-rose-600">
                    {formatTzs(detail.outstandingBalance)}
                  </p>
                </div>
              </div>

              {(detail.email || !detail.isActive) && (
                <div className="text-sm text-slate-600">
                  {detail.email ? (
                    <p>
                      {t('suppliers.email')}: {detail.email}
                    </p>
                  ) : null}
                  {!detail.isActive ? (
                    <p className="mt-1 text-amber-700">{t('common.inactive')}</p>
                  ) : null}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('debts.outstanding')}</h3>
                {detail.outstandingSales.length === 0 ? (
                  <p className="rounded-xl border border-slate-100 bg-white/60 px-4 py-5 text-center text-sm text-slate-400">
                    {t('debts.noDebts')}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white/60">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">{t('common.invoice')}</th>
                          <th className="px-3 py-2.5 font-medium">{t('common.date')}</th>
                          <th className="px-3 py-2.5 font-medium">{t('common.total')}</th>
                          <th className="px-3 py-2.5 font-medium">{t('customers.paid')}</th>
                          <th className="px-3 py-2.5 font-medium">{t('debts.outstanding')}</th>
                          <th className="px-3 py-2.5 font-medium">{t('common.status')}</th>
                          {canRecordPayment ? (
                            <th className="px-3 py-2.5 font-medium" />
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.outstandingSales.map((sale) => (
                          <tr key={sale.id} className="border-t border-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">
                              {new Date(sale.soldAt).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">{formatTzs(sale.totalAmount)}</td>
                            <td className="px-3 py-2.5">{formatTzs(sale.amountPaid)}</td>
                            <td className="px-3 py-2.5 font-semibold text-rose-600">
                              {formatTzs(sale.amountDue)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {labelStatus(sale.paymentStatus, t)}
                            </td>
                            {canRecordPayment ? (
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onPaySale(sale)}
                                  className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white"
                                >
                                  {t('debts.recordPayment')}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!canRecordPayment ? (
                  <p className="mt-2 text-xs text-slate-500">{t('common.view')}</p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{t('debts.paymentHistory')}</h3>
                {detail.transactions.length === 0 ? (
                  <p className="rounded-xl border border-slate-100 bg-white/60 px-4 py-5 text-center text-sm text-slate-400">
                    {t('customers.noLedger')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.transactions.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{t.type}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(t.createdAt).toLocaleString()}
                            {t.reference ? ` · ${t.reference}` : ''}
                          </p>
                          {t.notes ? (
                            <p className="mt-0.5 truncate text-xs text-slate-400">{t.notes}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={
                              Number(t.amount) < 0
                                ? 'font-medium text-emerald-600'
                                : 'font-medium text-slate-900'
                            }
                          >
                            {formatTzs(t.amount)}
                          </p>
                          <p className="text-xs text-slate-400">
                            Bal {formatTzs(t.balanceAfter)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common.back')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DebtPaymentModal({
  customerId,
  customerName,
  sale,
  isPending,
  onClose,
  onSubmit,
}: {
  customerId: string;
  customerName: string;
  sale: OutstandingSale;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: {
    customerId: string;
    saleId: string;
    amount: number;
    method: DebtPaymentMethod;
    reference?: string | null;
    notes?: string | null;
  }) => void;
}) {
  const { t } = useLocale();
  const amountDue = Number(sale.amountDue);
  const [amount, setAmount] = useState(String(amountDue));
  const [method, setMethod] = useState<DebtPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t('common.amount'));
      return;
    }
    if (value > amountDue) {
      toast.error(t('common.amount'));
      return;
    }

    onSubmit({
      customerId,
      saleId: sale.id,
      amount: value,
      method,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-4">
      <div
        className="glass-card w-full max-w-md overflow-hidden shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-payment-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div>
            <h2 id="debt-payment-title" className="text-lg font-semibold text-slate-900">
              {t('debts.recordPayment')}
            </h2>
            <p className="page-subtitle">
              {customerName} · {sale.invoiceNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-5">
          <div className="rounded-xl border border-slate-100 bg-white/60 p-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{t('common.total')}</span>
              <span>{formatTzs(sale.totalAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-slate-600">
              <span>{t('customers.paid')}</span>
              <span>{formatTzs(sale.amountPaid)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold text-rose-600">
              <span>{t('debts.outstanding')}</span>
              <span>{formatTzs(sale.amountDue)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
              {t('common.amount')}
            </label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              max={amountDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              required
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
              {t('common.method')}
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as DebtPaymentMethod)}
              disabled={isPending}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
            >
<option value="CASH">{t('common.cash')}</option>
<option value="MPESA">{t('common.mpesa')}</option>
<option value="BANK">{t('common.bank')}</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
              {t('common.reference')}
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={isPending}
              placeholder={t('common.reference')}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
              {t('common.notes')}
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              placeholder={t('common.notes')}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300 disabled:opacity-60"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white/80 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-11 flex-1 rounded-xl bg-brand-navy text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? t('pos.processing') : t('debts.confirmPayment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
