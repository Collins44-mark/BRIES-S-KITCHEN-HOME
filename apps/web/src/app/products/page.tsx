'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { ProductUnitsModal } from '@/components/products/product-units-modal';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { useLocale } from '@/contexts/locale-context';
import { statusKey } from '@/lib/i18n/dictionaries';
import { listCategories } from '@/lib/supabase/categories';
import {
  createProduct,
  listProducts,
  setProductStatus,
  updateProduct,
  type ProductListItem,
  type ProductStatus,
} from '@/lib/supabase/products';
import { formatTzs } from '@/lib/utils';

export default function ProductsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="glass-card h-40 animate-pulse bg-white/40" />}>
        <ProductsView />
      </Suspense>
    </AppShell>
  );
}

function ProductsView() {
  const { t } = useLocale();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [unitsProduct, setUnitsProduct] = useState<ProductListItem | null>(null);

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['products', search, categoryId, statusFilter],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        categoryId: categoryId || undefined,
        status: statusFilter,
      }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => listCategories({ includeInactive: false }),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast.success(t('common.saved'));
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      sku: string;
      name: string;
      categoryId: string;
      sellingPrice: number;
      reorderLevel: number;
      unit: string;
      barcode?: string | null;
      status: ProductStatus;
    }) => updateProduct(id, input),
    onSuccess: () => {
      toast.success(t('common.changesSaved'));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) =>
      setProductStatus(id, status),
    onSuccess: () => {
      toast.success(t('common.changesSaved'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      sku: String(fd.get('sku')),
      name: String(fd.get('name')),
      categoryId: String(fd.get('categoryId')),
      costPrice: Number(fd.get('costPrice')),
      sellingPrice: Number(fd.get('sellingPrice')),
      reorderLevel: Number(fd.get('reorderLevel') || 10),
      unit: String(fd.get('unit') || 'pcs'),
      barcode: String(fd.get('barcode') || '') || null,
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      sku: String(fd.get('sku')),
      name: String(fd.get('name')),
      categoryId: String(fd.get('categoryId')),
      sellingPrice: Number(fd.get('sellingPrice')),
      reorderLevel: Number(fd.get('reorderLevel') || 10),
      unit: String(fd.get('unit') || 'pcs'),
      barcode: String(fd.get('barcode') || '') || null,
      status: String(fd.get('status')) as ProductStatus,
    });
  }

  function labelStatus(status: string) {
    const key = statusKey(status);
    return key ? t(key) : status.replaceAll('_', ' ');
  }

  function productActions(p: ProductListItem) {
    return [
      {
        label: t('common.edit'),
        onClick: () => {
          setShowForm(false);
          setEditing(p);
        },
      },
      {
        label: t('products.units'),
        onClick: () => setUnitsProduct(p),
      },
      p.status === 'ACTIVE'
        ? {
            label: t('common.deactivate'),
            disabled: statusMutation.isPending,
            tone: 'danger' as const,
            onClick: () => statusMutation.mutate({ id: p.id, status: 'INACTIVE' }),
          }
        : p.status !== 'DISCONTINUED'
          ? {
              label: t('common.activate'),
              disabled: statusMutation.isPending,
              onClick: () => statusMutation.mutate({ id: p.id, status: 'ACTIVE' }),
            }
          : null,
    ];
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('products.title')}</h1>
          <p className="page-subtitle">{t('products.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm && !editing ? t('common.close') : t('products.add')}
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-3">
          <input name="sku" required placeholder={t('products.sku')} className="input" />
          <input name="name" required placeholder={t('products.product')} className="input" />
          <select name="categoryId" required className="input">
            <option value="">{t('common.category')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="costPrice"
            required
            type="number"
            min={0}
            step="0.01"
            placeholder={t('products.cost')}
            className="input"
          />
          <input
            name="sellingPrice"
            required
            type="number"
            min={0}
            step="0.01"
            placeholder={t('products.sellingPrice')}
            className="input"
          />
          <input
            name="reorderLevel"
            type="number"
            min={0}
            placeholder={t('products.stock')}
            defaultValue={10}
            className="input"
          />
          <input
            name="unit"
            placeholder={t('common.unit')}
            defaultValue="pcs"
            className="input"
          />
          <input name="barcode" placeholder={t('common.reference')} className="input" />
          <div className="md:col-span-3 rounded-xl border border-slate-100 bg-white/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('products.sellingUnits')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('products.manageUnitsHint')}</p>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? t('common.loading') : t('common.save')}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-3">
          <input
            name="sku"
            required
            defaultValue={editing.sku}
            placeholder={t('products.sku')}
            className="input"
          />
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder={t('products.product')}
            className="input"
          />
          <select name="categoryId" required defaultValue={editing.categoryId} className="input">
            <option value="">{t('common.category')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={formatTzs(editing.costPrice)}
            readOnly
            disabled
            className="input opacity-70"
            title={t('products.cost')}
          />
          <input
            name="sellingPrice"
            required
            type="number"
            min={0}
            step="0.01"
            defaultValue={editing.sellingPrice}
            placeholder={t('products.sellingPrice')}
            className="input"
          />
          <input
            value={`${editing.stockQuantity} ${editing.unit}`}
            readOnly
            disabled
            className="input opacity-70"
            title={t('products.stock')}
          />
          <input
            name="reorderLevel"
            type="number"
            min={0}
            defaultValue={editing.reorderLevel}
            placeholder={t('products.stock')}
            className="input"
          />
          <input
            name="unit"
            defaultValue={editing.unit}
            placeholder={t('common.unit')}
            className="input"
          />
          <input
            name="barcode"
            defaultValue={editing.barcode ?? ''}
            placeholder={t('common.reference')}
            className="input"
          />
          <select name="status" defaultValue={editing.status} className="input">
            <option value="ACTIVE">{labelStatus('ACTIVE')}</option>
            <option value="INACTIVE">{labelStatus('INACTIVE')}</option>
            <option value="DISCONTINUED">DISCONTINUED</option>
          </select>
          <div className="md:col-span-3 rounded-xl border border-slate-100 bg-white/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('products.sellingUnits')}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t('products.manageUnitsHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setUnitsProduct(editing)}
                className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                {t('products.units')}
              </button>
            </div>
          </div>
          <div className="flex gap-2 md:col-span-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? t('common.loading') : t('products.edit')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('products.search')}
            className="input w-full max-w-full sm:max-w-md"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input w-full sm:max-w-[200px]"
          >
            <option value="">{t('common.all')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProductStatus | 'ALL')}
            className="input w-full sm:max-w-[180px]"
          >
            <option value="ALL">{t('common.all')}</option>
            <option value="ACTIVE">{labelStatus('ACTIVE')}</option>
            <option value="INACTIVE">{labelStatus('INACTIVE')}</option>
            <option value="DISCONTINUED">DISCONTINUED</option>
          </select>
        </div>

        <div className="divide-y divide-slate-50 lg:hidden">
          {isLoading && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">{t('common.loading')}</p>
          )}
          {isError && !isLoading && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-600">{t('common.unableLoad')}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 min-h-11 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
              >
                {t('common.retry')}
              </button>
            </div>
          )}
          {!isLoading && !isError && products.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">{t('products.noProducts')}</p>
          )}
          {!isLoading &&
            !isError &&
            products.map((p) => (
              <div key={p.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.sku}
                      {p.categoryName ? ` · ${p.categoryName}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatTzs(p.sellingPrice)}
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] font-medium ${
                        p.stockStatus === 'OUT_OF_STOCK'
                          ? 'text-rose-600'
                          : p.stockStatus === 'LOW_STOCK'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                      }`}
                    >
                      {p.stockQuantity} · {labelStatus(p.stockStatus)}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{labelStatus(p.status)}</p>
                <div className="mt-2.5 flex justify-end">
                  <RowActionsMenu actions={productActions(p)} />
                </div>
              </div>
            ))}
        </div>

        <div className="table-scroll hidden lg:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t('products.sku')}</th>
                <th className="px-4 py-3 font-medium">{t('products.product')}</th>
                <th className="px-4 py-3 font-medium">{t('common.category')}</th>
                <th className="px-4 py-3 font-medium">{t('products.cost')}</th>
                <th className="px-4 py-3 font-medium">{t('products.sellingPrice')}</th>
                <th className="px-4 py-3 font-medium">{t('products.stock')}</th>
                <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                <th className="px-4 py-3 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRow colSpan={8} />}
              {isError && !isLoading && <TableErrorRow colSpan={8} onRetry={() => refetch()} />}
              {!isLoading && !isError && products.length === 0 && (
                <TableEmptyRow colSpan={8} message={t('products.noProducts')} />
              )}
              {!isLoading &&
                !isError &&
                products.map((p) => (
                  <tr key={p.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.categoryName}</td>
                    <td className="px-4 py-3">{formatTzs(p.costPrice)}</td>
                    <td className="px-4 py-3">{formatTzs(p.sellingPrice)}</td>
                    <td className="px-4 py-3">{p.stockQuantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={
                            p.stockStatus === 'OUT_OF_STOCK'
                              ? 'text-rose-600'
                              : p.stockStatus === 'LOW_STOCK'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }
                        >
                          {labelStatus(p.stockStatus)}
                        </span>
                        <span className="text-[11px] text-slate-400">{labelStatus(p.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowActionsMenu actions={productActions(p)} />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {unitsProduct && (
        <ProductUnitsModal
          productId={unitsProduct.id}
          productName={unitsProduct.name}
          onClose={() => setUnitsProduct(null)}
        />
      )}

      <style jsx global>{`
        .input {
          height: 2.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.8);
          padding: 0 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #7dd3fc;
          box-shadow: 0 0 0 2px rgba(186, 230, 253, 0.8);
        }
      `}</style>
    </div>
  );
}
