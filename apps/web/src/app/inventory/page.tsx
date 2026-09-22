'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import {
  TableEmptyRow,
  TableErrorRow,
  TableLoadingRow,
} from '@/components/ui/query-status';
import { listCategories } from '@/lib/supabase/categories';
import {
  getInventoryProductDetails,
  listInventory,
  listInventoryMovements,
  type InventoryMovement,
  type InventoryMovementType,
  type InventoryProduct,
  type InventoryProductDetails,
  type InventoryStockStatus,
} from '@/lib/supabase/inventory';
import { formatTzs } from '@/lib/utils';

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryView />
    </AppShell>
  );
}

function stockBadgeClass(status: InventoryStockStatus): string {
  if (status === 'IN_STOCK') return 'bg-emerald-50 text-emerald-700';
  if (status === 'LOW_STOCK') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

function InventoryView() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | 'ALL'>('ALL');
  const [movementType, setMovementType] = useState<InventoryMovementType | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => listCategories({ includeInactive: false }),
  });

  const {
    data,
    isLoading,
    isError,
    refetch,
    error,
  } = useQuery({
    queryKey: ['inventory', search, categoryId, stockStatus],
    queryFn: () =>
      listInventory({
        search: search || undefined,
        categoryId: categoryId || undefined,
        stockStatus,
      }),
  });

  const {
    data: movements = [],
    isLoading: movementsLoading,
    isError: movementsError,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ['inventory-movements', movementType],
    queryFn: () =>
      listInventoryMovements({
        type: movementType,
        limit: 50,
      }),
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['inventory-product', selectedId],
    queryFn: () => getInventoryProductDetails(selectedId!),
    enabled: !!selectedId,
  });

  const products = data?.products ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock levels from products and movement history. Stock changes via sales and purchases.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'In Stock',
            value: isLoading ? '—' : (data?.inStock ?? 0),
            color: 'text-emerald-600',
          },
          {
            label: 'Low Stock',
            value: isLoading ? '—' : (data?.lowStock ?? 0),
            color: 'text-amber-600',
          },
          {
            label: 'Out of Stock',
            value: isLoading ? '—' : (data?.outOfStock ?? 0),
            color: 'text-rose-600',
          },
          {
            label: 'Stock Value',
            value: isLoading ? '—' : formatTzs(data?.totalStockValue ?? '0'),
            color: 'text-slate-900',
          },
        ].map((card) => (
          <div key={card.label} className="glass-card p-5">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card flex flex-col gap-3 p-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or SKU..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pl-10 pr-3 text-sm outline-none focus:border-sky-300"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={stockStatus}
          onChange={(e) => setStockStatus(e.target.value as InventoryStockStatus | 'ALL')}
          className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
        >
          <option value="ALL">All stock statuses</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
      </div>

      {isError && !isLoading && (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-slate-600">
            {error instanceof Error ? error.message : 'Unable to load inventory.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Products</h2>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableLoadingRow colSpan={3} />}
                {isError && !isLoading && (
                  <TableErrorRow colSpan={3} onRetry={() => refetch()} />
                )}
                {!isLoading && !isError && products.length === 0 && (
                  <TableEmptyRow colSpan={3} message="No inventory data yet" />
                )}
                {!isLoading &&
                  !isError &&
                  products.map((p: InventoryProduct) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-t border-slate-50 transition hover:bg-white/70"
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.sku} · {p.categoryName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {p.stockQuantity} {p.unit}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${stockBadgeClass(p.stockStatus)}`}
                        >
                          {p.stockStatus.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Recent Movements</h2>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as InventoryMovementType | 'ALL')}
              className="h-9 rounded-lg border border-slate-200 bg-white/80 px-2 text-xs"
            >
              <option value="ALL">All types</option>
              <option value="PURCHASE">Purchase</option>
              <option value="SALE">Sale</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DAMAGE">Damage</option>
              <option value="LOSS">Loss</option>
            </select>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty</th>
                </tr>
              </thead>
              <tbody>
                {movementsLoading && <TableLoadingRow colSpan={3} />}
                {movementsError && !movementsLoading && (
                  <TableErrorRow colSpan={3} onRetry={() => refetchMovements()} />
                )}
                {!movementsLoading && !movementsError && movements.length === 0 && (
                  <TableEmptyRow colSpan={3} message="No movements yet" />
                )}
                {!movementsLoading &&
                  !movementsError &&
                  movements.map((m: InventoryMovement) => (
                    <tr key={m.id} className="border-t border-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{m.productName}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                          {m.reference ? ` · ${m.reference}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">{m.type}</td>
                      <td className="px-4 py-3 font-medium">
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedId && (
        <InventoryDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          errorMessage={
            detailErrorObj instanceof Error
              ? detailErrorObj.message
              : 'Unable to load product inventory.'
          }
          onBack={() => setSelectedId(null)}
          onRetry={() => refetchDetail()}
        />
      )}
    </div>
  );
}

function InventoryDetailModal({
  detail,
  loading,
  error,
  errorMessage,
  onBack,
  onRetry,
}: {
  detail: InventoryProductDetails | undefined;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center sm:p-4">
      <div
        className="glass-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-detail-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Inventory
            </button>
            <h2
              id="inventory-detail-title"
              className="truncate text-lg font-semibold text-slate-900"
            >
              {detail?.name ?? (loading ? 'Loading…' : 'Product inventory')}
            </h2>
            {detail ? (
              <p className="mt-1 text-sm text-slate-500">
                {detail.sku} · {detail.categoryName}
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
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
                >
                  Back to Inventory
                </button>
              </div>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4">
                  <p className="text-xs uppercase text-slate-400">Current stock</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {detail.stockQuantity} {detail.unit}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${stockBadgeClass(detail.stockStatus)}`}
                  >
                    {detail.stockStatus.replaceAll('_', ' ')}
                  </span>
                  <p className="mt-2 text-xs text-slate-400">
                    From products.stock_quantity (not summed from movements)
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/60 p-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Cost price</span>
                    <span>{formatTzs(detail.costPrice)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>Selling price</span>
                    <span>{formatTzs(detail.sellingPrice)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-slate-600">
                    <span>Reorder level</span>
                    <span>{detail.reorderLevel}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Recent movements</h3>
                {detail.recentMovements.length === 0 ? (
                  <p className="rounded-xl border border-slate-100 bg-white/60 px-4 py-5 text-center text-sm text-slate-400">
                    No movements for this product
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.recentMovements.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{m.type}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(m.createdAt).toLocaleString()}
                            {m.reference ? ` · ${m.reference}` : ''}
                          </p>
                          <p className="text-xs text-slate-400">
                            {m.quantityBefore} → {m.quantityAfter}
                            {m.createdByName !== '—' ? ` · ${m.createdByName}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 font-medium text-slate-900">
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </p>
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
                  Back to Inventory
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
