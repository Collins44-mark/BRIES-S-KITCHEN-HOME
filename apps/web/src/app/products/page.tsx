'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
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
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<ProductListItem | null>(null);

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
      toast.success('Product created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create product'),
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
      toast.success('Product updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update product'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) =>
      setProductStatus(id, status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'ACTIVE'
          ? 'Product activated'
          : vars.status === 'INACTIVE'
            ? 'Product deactivated'
            : 'Product discontinued',
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update product status'),
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your kitchenware catalog.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm && !editing ? 'Close' : 'Add Product'}
        </button>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-3">
          <input name="sku" required placeholder="SKU" className="input" />
          <input name="name" required placeholder="Product name" className="input" />
          <select name="categoryId" required className="input">
            <option value="">Category</option>
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
            placeholder="Initial cost price"
            className="input"
          />
          <input
            name="sellingPrice"
            required
            type="number"
            min={0}
            step="0.01"
            placeholder="Selling price"
            className="input"
          />
          <input
            name="reorderLevel"
            type="number"
            min={0}
            placeholder="Reorder level"
            defaultValue={10}
            className="input"
          />
          <input name="unit" placeholder="Unit (pcs)" defaultValue="pcs" className="input" />
          <input name="barcode" placeholder="Barcode" className="input" />
          <p className="md:col-span-3 text-xs text-slate-500">
            Stock starts at 0 and is updated through purchases. Cost price after create is updated
            when stock is received.
          </p>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Product'}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-3">
          <input name="sku" required defaultValue={editing.sku} placeholder="SKU" className="input" />
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder="Product name"
            className="input"
          />
          <select name="categoryId" required defaultValue={editing.categoryId} className="input">
            <option value="">Category</option>
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
            title="Cost price is updated via purchases"
          />
          <input
            name="sellingPrice"
            required
            type="number"
            min={0}
            step="0.01"
            defaultValue={editing.sellingPrice}
            placeholder="Selling price"
            className="input"
          />
          <input
            value={`${editing.stockQuantity} ${editing.unit}`}
            readOnly
            disabled
            className="input opacity-70"
            title="Stock is updated via purchases / inventory"
          />
          <input
            name="reorderLevel"
            type="number"
            min={0}
            defaultValue={editing.reorderLevel}
            placeholder="Reorder level"
            className="input"
          />
          <input name="unit" defaultValue={editing.unit} placeholder="Unit" className="input" />
          <input
            name="barcode"
            defaultValue={editing.barcode ?? ''}
            placeholder="Barcode"
            className="input"
          />
          <select name="status" defaultValue={editing.status} className="input">
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DISCONTINUED">DISCONTINUED</option>
          </select>
          <div className="flex gap-2 md:col-span-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Product'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input max-w-md"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input max-w-[200px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProductStatus | 'ALL')}
            className="input max-w-[180px]"
          >
            <option value="ALL">Active + inactive</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="DISCONTINUED">DISCONTINUED</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRow colSpan={8} />}
              {isError && !isLoading && <TableErrorRow colSpan={8} onRetry={() => refetch()} />}
              {!isLoading && !isError && products.length === 0 && (
                <TableEmptyRow colSpan={8} message="No products yet" />
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
                          {p.stockStatus.replaceAll('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400">{p.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setEditing(p);
                          }}
                          className="text-sm font-medium text-sky-600 hover:text-sky-700"
                        >
                          Edit
                        </button>
                        {p.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'INACTIVE' })}
                            className="text-sm font-medium text-slate-600 hover:text-slate-800"
                          >
                            Deactivate
                          </button>
                        ) : p.status !== 'DISCONTINUED' ? (
                          <button
                            type="button"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'ACTIVE' })}
                            className="text-sm font-medium text-slate-600 hover:text-slate-800"
                          >
                            Activate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

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
