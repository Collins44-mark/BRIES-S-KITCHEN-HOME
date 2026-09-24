'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { useAuth } from '@/contexts/auth-context';
import { useDateRange } from '@/contexts/date-range-context';
import { listProducts, type ProductListItem } from '@/lib/supabase/products';
import {
  derivePurchasePaymentStatus,
  getPurchaseById,
  listPurchases,
  moneyRound,
  receivePurchase,
  type PurchaseDetail,
  type PurchaseListItem,
  type PurchasePaymentStatus,
  type PurchaseStatus,
} from '@/lib/supabase/purchases';
import { listSuppliers, type SupplierListItem } from '@/lib/supabase/suppliers';
import { formatTzs } from '@/lib/utils';

type DraftLine = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

function newLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    quantity: '1',
    unitCost: '',
  };
}

export default function PurchasesPage() {
  return (
    <AppShell>
      <PurchasesView />
    </AppShell>
  );
}

function statusBadgeClass(status: PurchaseStatus): string {
  if (status === 'RECEIVED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ORDERED') return 'bg-sky-50 text-sky-700';
  if (status === 'DRAFT') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-600';
}

function paymentBadgeClass(status: PurchasePaymentStatus): string {
  if (status === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIAL') return 'bg-amber-50 text-amber-700';
  if (status === 'PENDING') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function PurchasesView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { preset, from, to, label } = useDateRange();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseStatus | 'ALL'>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canReceive =
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    user?.role === 'INVENTORY_MANAGER';

  const {
    data: purchases = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['purchases-history', preset, from, to, search, status, paymentStatus],
    queryFn: () =>
      listPurchases({
        preset,
        from,
        to,
        search: search || undefined,
        status,
        paymentStatus,
      }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: () => listSuppliers({ includeInactive: false }),
    enabled: showForm,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'ACTIVE'],
    queryFn: () => listProducts({ status: 'ACTIVE' }),
    enabled: showForm,
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['purchase-detail', selectedId],
    queryFn: () => getPurchaseById(selectedId!),
    enabled: !!selectedId,
  });

  const receiveMutation = useMutation({
    mutationFn: receivePurchase,
    onSuccess: (purchase) => {
      toast.success(`Purchase received — ${purchase.reference}`);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['purchases-history'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to receive purchase'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Purchases</h1>
          <p className="page-subtitle">
            Purchase history for {label.toLowerCase()}. Receive stock from active suppliers.
          </p>
        </div>
        {canReceive ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
          >
            {showForm ? 'Close' : 'Receive Purchase'}
          </button>
        ) : null}
      </div>

      {showForm && canReceive && (
        <ReceivePurchaseForm
          suppliers={suppliers}
          products={products}
          isPending={receiveMutation.isPending}
          onCancel={() => setShowForm(false)}
          onSubmit={(input) => receiveMutation.mutate(input)}
        />
      )}

      <div className="glass-card flex flex-col gap-3 p-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference or supplier..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pl-10 pr-3 text-sm outline-none focus:border-sky-300"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PurchaseStatus | 'ALL')}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ORDERED">Ordered</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as PurchasePaymentStatus | 'ALL')}
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
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableLoadingRow colSpan={7} />}
            {isError && !isLoading && <TableErrorRow colSpan={7} onRetry={() => refetch()} />}
            {!isLoading && !isError && purchases.length === 0 && (
              <TableEmptyRow colSpan={7} message="No purchases for this period" />
            )}
            {!isLoading &&
              !isError &&
              purchases.map((p: PurchaseListItem) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t border-slate-50 transition hover:bg-white/70"
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{p.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{p.supplierName}</td>
                  <td className="px-4 py-3">{formatTzs(p.totalAmount)}</td>
                  <td className="px-4 py-3">{formatTzs(p.amountPaid)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(p.paymentStatus)}`}
                    >
                      {p.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(p.purchaseDate).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>

      {selectedId && (
        <PurchaseDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          errorMessage={
            detailErrorObj instanceof Error
              ? detailErrorObj.message
              : 'Unable to load purchase detail.'
          }
          onBack={() => setSelectedId(null)}
          onRetry={() => refetchDetail()}
        />
      )}
    </div>
  );
}

function ReceivePurchaseForm({
  suppliers,
  products,
  isPending,
  onCancel,
  onSubmit,
}: {
  suppliers: SupplierListItem[];
  products: ProductListItem[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    supplierId: string;
    reference?: string | null;
    amountPaid: number;
    previewTotal: number;
    purchaseDate?: string | null;
    notes?: string | null;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
  }) => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [amountPaid, setAmountPaid] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);

  const preview = useMemo(() => {
    const parsed = lines.map((line) => {
      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost);
      const qtyOk = Number.isInteger(quantity) && quantity >= 1;
      const costOk = Number.isFinite(unitCost) && unitCost >= 0;
      const lineTotal =
        line.productId && qtyOk && costOk ? moneyRound(quantity * unitCost) : 0;
      return { ...line, quantity, unitCost, qtyOk, costOk, lineTotal };
    });
    const total = moneyRound(parsed.reduce((sum, l) => sum + l.lineTotal, 0));
    return { parsed, total };
  }, [lines]);

  const paidValue = amountTouched
    ? Number(amountPaid)
    : preview.total;
  const paidDisplay = amountTouched ? amountPaid : String(preview.total);
  const derivedStatus =
    preview.total === 0 && moneyRound(Number.isFinite(paidValue) ? paidValue : 0) === 0
      ? 'PENDING'
      : derivePurchasePaymentStatus(
          Number.isFinite(paidValue) ? paidValue : 0,
          preview.total,
        );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;

    if (!supplierId) {
      toast.error('Select a supplier.');
      return;
    }

    const items: Array<{ productId: string; quantity: number; unitCost: number }> = [];
    for (const line of preview.parsed) {
      if (!line.productId) {
        toast.error('Each line needs a product.');
        return;
      }
      if (!line.qtyOk) {
        toast.error('Each line needs a quantity of at least 1.');
        return;
      }
      if (!line.costOk) {
        toast.error('Unit cost must be 0 or greater.');
        return;
      }
      items.push({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: moneyRound(line.unitCost),
      });
    }

    if (!items.length) {
      toast.error('Add at least one product line.');
      return;
    }

    const ids = items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      toast.error('Each product can only appear once in the purchase.');
      return;
    }

    const paid = moneyRound(amountTouched ? Number(amountPaid) : preview.total);
    if (!Number.isFinite(paid) || paid < 0) {
      toast.error('Enter a valid amount paid.');
      return;
    }
    if (paid > preview.total) {
      toast.error('Amount paid cannot exceed the purchase total.');
      return;
    }

    onSubmit({
      supplierId,
      reference: reference.trim() || null,
      amountPaid: paid,
      previewTotal: preview.total,
      purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : null,
      notes: notes.trim() || null,
      items,
    });
  }

  const selectedProductIds = new Set(lines.map((l) => l.productId).filter(Boolean));

  return (
    <form onSubmit={handleSubmit} className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">Receive purchase</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          required
          disabled={isPending}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
        >
          <option value="">Select supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={isPending}
          placeholder="Reference (optional — auto if empty)"
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
        />
        <input
          type="datetime-local"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          disabled={isPending}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          placeholder="Notes (optional)"
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Line items</h3>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </button>
        </div>

        {lines.map((line) => {
          const parsed = preview.parsed.find((p) => p.key === line.key);
          return (
            <div
              key={line.key}
              className="flex flex-col gap-2.5 rounded-xl border border-slate-100 bg-white/60 p-3 md:grid md:grid-cols-12 md:gap-2"
            >
              <div className="min-w-0 md:col-span-5">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
                  Product
                </label>
                <select
                  value={line.productId}
                  onChange={(e) => {
                    const productId = e.target.value;
                    const product = products.find((p) => p.id === productId);
                    updateLine(line.key, {
                      productId,
                      unitCost:
                        line.unitCost === '' && product
                          ? String(Number(product.costPrice))
                          : line.unitCost,
                    });
                  }}
                  required
                  disabled={isPending}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
                >
                  <option value="">Product</option>
                  {products.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={selectedProductIds.has(p.id) && p.id !== line.productId}
                    >
                      {p.name} (stock {p.stockQuantity})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 md:contents">
                <div className="min-w-0 md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    disabled={isPending}
                    placeholder="Qty"
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
                  />
                </div>
                <div className="min-w-0 md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
                    Unit cost
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                    disabled={isPending}
                    placeholder="Unit cost"
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 md:col-span-3 md:border-0 md:pt-0">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
                    Subtotal
                  </p>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatTzs(parsed?.lineTotal ?? 0)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPending || lines.length === 1}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white/60 p-4 md:col-span-1">
          <p className="text-xs uppercase text-slate-400">Preview total</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatTzs(preview.total)}</p>
          <p className="mt-1 text-xs text-slate-400">Preview only — RPC is authoritative</p>
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
            Amount paid
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            max={preview.total}
            value={paidDisplay}
            onChange={(e) => {
              setAmountTouched(true);
              setAmountPaid(e.target.value);
            }}
            disabled={isPending}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-1">
          <label className="mb-1 block text-xs font-medium uppercase text-slate-400">
            Payment status
          </label>
          <div className="flex h-11 items-center rounded-xl border border-slate-100 bg-white/60 px-3">
            <span
              className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(derivedStatus)}`}
            >
              {derivedStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Processing…' : 'Confirm receive'}
        </button>
      </div>
    </form>
  );
}

function PurchaseDetailModal({
  detail,
  loading,
  error,
  errorMessage,
  onBack,
  onRetry,
}: {
  detail: PurchaseDetail | undefined;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center sm:p-4">
      <div
        className="glass-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-detail-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Purchases
            </button>
            <h2
              id="purchase-detail-title"
              className="truncate text-lg font-semibold text-slate-900"
            >
              {detail?.reference ?? (loading ? 'Loading purchase…' : 'Purchase detail')}
            </h2>
            {detail ? (
              <p className="page-subtitle">
                {detail.supplierName} · {new Date(detail.purchaseDate).toLocaleString()}
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
                  Back to Purchases
                </button>
              </div>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Supplier</p>
                  <p className="mt-1 font-medium text-slate-900">{detail.supplierName}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Created by: {detail.createdByName}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${statusBadgeClass(detail.status)}`}
                    >
                      {detail.status}
                    </span>
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(detail.paymentStatus)}`}
                    >
                      {detail.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Received:{' '}
                    {detail.receivedAt
                      ? new Date(detail.receivedAt).toLocaleString()
                      : 'Not received yet'}
                  </p>
                  {detail.notes ? (
                    <p className="mt-2 text-sm text-slate-500">Notes: {detail.notes}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Items</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white/60">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-slate-50/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Product</th>
                        <th className="px-3 py-2.5 font-medium">Qty</th>
                        <th className="px-3 py-2.5 font-medium">Unit cost</th>
                        <th className="px-3 py-2.5 font-medium">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                            No line items
                          </td>
                        </tr>
                      ) : (
                        detail.items.map((item) => (
                          <tr key={item.id} className="border-t border-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {item.productName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {formatTzs(item.unitCost)}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {formatTzs(item.lineTotal)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Financial summary</h3>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatTzs(detail.subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{formatTzs(detail.totalAmount)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>Amount paid</span>
                    <span>{formatTzs(detail.amountPaid)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Purchases
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
