'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { productsApi, purchasesApi } from '@/lib/services';
import { formatTzs } from '@/lib/utils';

export default function PurchasesPage() {
  return (
    <AppShell>
      <PurchasesView />
    </AppShell>
  );
}

function PurchasesView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: purchasesApi.list,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: purchasesApi.suppliers,
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list(),
  });

  const createPurchase = useMutation({
    mutationFn: purchasesApi.create,
    onSuccess: () => {
      toast.success('Purchase recorded — stock updated');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: () => toast.error('Failed to create purchase'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createPurchase.mutate({
      supplierId: String(fd.get('supplierId')),
      reference: String(fd.get('reference') || '') || undefined,
      items: [
        {
          productId: String(fd.get('productId')),
          quantity: Number(fd.get('quantity')),
          unitCost: Number(fd.get('unitCost')),
        },
      ],
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">Receive stock from suppliers.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showForm ? 'Close' : 'New Purchase'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <select name="supplierId" required className="field">
            <option value="">Supplier</option>
            {(suppliers as Array<{ id: string; name: string }>).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input name="reference" placeholder="Invoice / reference" className="field" />
          <select name="productId" required className="field">
            <option value="">Product</option>
            {products.slice(0, 50).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input name="quantity" required type="number" min={1} placeholder="Quantity" className="field" />
          <input name="unitCost" required type="number" min={0} placeholder="Unit cost" className="field" />
          <button type="submit" className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
            Save Purchase
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {(purchases as Array<{
              id: string;
              reference: string;
              supplier: { name: string };
              totalAmount: { toString(): string } | string;
              status: string;
              purchaseDate: string;
            }>).map((p) => (
              <tr key={p.id} className="border-t border-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.reference}</td>
                <td className="px-4 py-3">{p.supplier.name}</td>
                <td className="px-4 py-3">
                  {formatTzs(
                    typeof p.totalAmount === 'string' ? p.totalAmount : p.totalAmount.toString(),
                  )}
                </td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(p.purchaseDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .field {
          height: 2.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.8);
          padding: 0 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
