'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { listCategories } from '@/lib/supabase/categories';
import { fetchCustomerByPhone, fetchCustomers } from '@/lib/supabase/customers';
import { listProducts, type ProductListItem } from '@/lib/supabase/products';
import {
  createSale,
  type SaleDiscountType,
  type SalePaymentMethod,
} from '@/lib/supabase/sales';
import { formatTzs } from '@/lib/utils';

interface CartLine {
  product: ProductListItem;
  quantity: number;
}

export default function PosPage() {
  return (
    <AppShell>
      <PosView />
    </AppShell>
  );
}

function PosView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [discountType, setDiscountType] = useState<SaleDiscountType>('NONE');
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState('');

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['products', 'pos', search, categoryId],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        categoryId: categoryId || undefined,
        status: 'ACTIVE',
      }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => listCategories({ includeInactive: false }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'pos'],
    queryFn: () => fetchCustomers({ includeInactive: false, includeWalkIn: false }),
  });

  // UI preview only — create_sale remains authoritative for money totals.
  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.sellingPrice) * line.quantity, 0),
    [cart],
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'PERCENTAGE') return (subtotal * discountValue) / 100;
    if (discountType === 'FIXED') return Math.min(discountValue, subtotal);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const total = Math.max(subtotal - discountAmount, 0);

  const createSaleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (sale) => {
      const invoice = sale.invoice_number ? ` — ${sale.invoice_number}` : '';
      toast.success(`Sale completed${invoice}`);
      setCart([]);
      setDiscountType('NONE');
      setDiscountValue(0);
      setAmountTendered('');
      setCustomerId('');
      setPhoneSearch('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to complete sale'),
  });

  function addToCart(product: ProductListItem) {
    if (product.stockQuantity <= 0) {
      toast.error('Out of stock');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast.error('Not enough stock');
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  async function findCustomerByPhone() {
    if (!phoneSearch.trim()) return;
    try {
      const customer = await fetchCustomerByPhone(phoneSearch.trim());
      setCustomerId(customer.id);
      toast.success(`Selected ${customer.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Customer not found');
    }
  }

  function completeSale() {
    if (!cart.length) {
      toast.error('Cart is empty');
      return;
    }

    const tendered = amountTendered === '' ? total : Number(amountTendered);
    if (Number.isNaN(tendered) || tendered < 0) {
      toast.error('Enter a valid amount received');
      return;
    }
    if (tendered > total) {
      toast.error('Payment amount exceeds sale total');
      return;
    }
    if (tendered < total && !customerId) {
      toast.error('Credit sales require a registered customer');
      return;
    }

    // Money payments only — unpaid remainder becomes amount_due in the RPC.
    // Do NOT append { method: 'CREDIT', amount: owed }.
    const payments =
      tendered > 0 ? [{ method: paymentMethod, amount: tendered }] : [];

    createSaleMutation.mutate({
      customerId: customerId || null,
      items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      discountType,
      discountValue,
      payments,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">POS / Sales</h1>
        <p className="mt-1 text-sm text-slate-500">Search products, build a cart, and complete the sale.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <div className="glass-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products or barcode..."
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
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card h-36 animate-pulse bg-white/40" />
              ))}
            {isError && !isLoading && (
              <div className="glass-card col-span-full p-8 text-center sm:col-span-2 lg:col-span-3">
                <p className="text-sm text-slate-600">Unable to load products. Please try again.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoading && !isError && products.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-400 sm:col-span-2 lg:col-span-3">
                No products yet
              </p>
            )}
            {!isLoading &&
              !isError &&
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="glass-card p-4 text-left transition hover:bg-white/90"
                >
                  <p className="font-medium text-slate-800">{product.name}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatTzs(product.sellingPrice)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Stock: {product.stockQuantity} {product.unit}
                  </p>
                  <span className="mt-3 inline-flex rounded-lg bg-brand-navy px-2.5 py-1 text-xs font-medium text-white">
                    Add
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <div className="glass-card p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Current Cart</h2>
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No items yet.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div key={line.product.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{line.product.name}</p>
                      <p className="text-xs text-slate-500">{formatTzs(line.product.sellingPrice)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1"
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((l) =>
                                l.product.id === line.product.id
                                  ? { ...l, quantity: Math.max(1, l.quantity - 1) }
                                  : l,
                              )
                              .filter((l) => l.quantity > 0),
                          )
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1"
                        onClick={() => addToCart(line.product)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-rose-500"
                        onClick={() =>
                          setCart((prev) => prev.filter((l) => l.product.id !== line.product.id))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card space-y-3 p-5">
            <h2 className="text-base font-semibold text-slate-800">Customer</h2>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="Search by phone 0712345678"
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
              />
              <button
                type="button"
                onClick={findCustomerByPhone}
                className="rounded-xl bg-slate-100 px-3 text-sm font-medium"
              >
                Find
              </button>
            </div>
          </div>

          <div className="glass-card space-y-3 p-5">
            <h2 className="text-base font-semibold text-slate-800">Discount & Payment</h2>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as SaleDiscountType)}
                className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
              >
                <option value="NONE">No discount</option>
                <option value="PERCENTAGE">Percentage %</option>
                <option value="FIXED">Fixed amount</option>
              </select>
              <input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="h-11 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
                disabled={discountType === 'NONE'}
              />
            </div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="BANK">Bank</option>
            </select>
            <input
              type="number"
              min={0}
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              placeholder={`Amount received (default ${total})`}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
            />
            <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatTzs(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>-{formatTzs(discountAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatTzs(total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={completeSale}
              disabled={createSaleMutation.isPending || cart.length === 0}
              className="h-12 w-full rounded-2xl bg-brand-navy text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
