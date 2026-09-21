'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { inventoryApi } from '@/lib/services';
import { formatTzs } from '@/lib/utils';

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryView />
    </AppShell>
  );
}

function InventoryView() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: inventoryApi.overview,
  });
  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: inventoryApi.movements,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">Stock levels and movement history.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'In Stock', value: data?.inStock ?? '—', color: 'text-emerald-600' },
          { label: 'Low Stock', value: data?.lowStock ?? '—', color: 'text-amber-600' },
          { label: 'Out of Stock', value: data?.outOfStock ?? '—', color: 'text-rose-600' },
          {
            label: 'Stock Value',
            value: data ? formatTzs(data.totalStockValue) : '—',
            color: 'text-violet-700',
          },
        ].map((card) => (
          <div key={card.label} className="glass-card p-5">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Products</h2>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {(data?.products ?? []).map(
                  (p: {
                    id: string;
                    name: string;
                    stockQuantity: number;
                    stockStatus: string;
                  }) => (
                    <tr key={p.id} className="border-t border-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3">{p.stockQuantity}</td>
                      <td className="px-4 py-3 text-xs">{p.stockStatus.replaceAll('_', ' ')}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Recent Movements</h2>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty</th>
                </tr>
              </thead>
              <tbody>
                {(movements as Array<{
                  id: string;
                  type: string;
                  quantity: number;
                  product: { name: string };
                }>).map((m) => (
                  <tr key={m.id} className="border-t border-slate-50">
                    <td className="px-4 py-3">{m.product.name}</td>
                    <td className="px-4 py-3">{m.type}</td>
                    <td className="px-4 py-3">{m.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
