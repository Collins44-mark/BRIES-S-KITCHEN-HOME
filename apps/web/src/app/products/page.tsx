'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { categoriesApi, productsApi } from '@/lib/services';
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
  const [showForm, setShowForm] = useState(params.get('new') === '1');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productsApi.list(search || undefined),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });

  const createProduct = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      toast.success('Product created');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to create product'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createProduct.mutate({
      sku: String(fd.get('sku')),
      name: String(fd.get('name')),
      categoryId: String(fd.get('categoryId')),
      costPrice: Number(fd.get('costPrice')),
      sellingPrice: Number(fd.get('sellingPrice')),
      stockQuantity: Number(fd.get('stockQuantity') || 0),
      reorderLevel: Number(fd.get('reorderLevel') || 10),
      barcode: String(fd.get('barcode') || '') || undefined,
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
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm ? 'Close' : 'Add Product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-3">
          <input name="sku" required placeholder="SKU" className="input" />
          <input name="name" required placeholder="Product name" className="input" />
          <select name="categoryId" required className="input">
            <option value="">Category</option>
            {(categories as Array<{ id: string; name: string }>).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="costPrice" required type="number" min={0} placeholder="Cost price" className="input" />
          <input name="sellingPrice" required type="number" min={0} placeholder="Selling price" className="input" />
          <input name="stockQuantity" type="number" min={0} placeholder="Stock qty" className="input" />
          <input name="reorderLevel" type="number" min={0} placeholder="Reorder level" className="input" />
          <input name="barcode" placeholder="Barcode" className="input" />
          <button type="submit" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
            Save Product
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input max-w-md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-50">
                  <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.categoryName}</td>
                  <td className="px-4 py-3">{formatTzs(p.costPrice)}</td>
                  <td className="px-4 py-3">{formatTzs(p.sellingPrice)}</td>
                  <td className="px-4 py-3">{p.stockQuantity}</td>
                  <td className="px-4 py-3">
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
