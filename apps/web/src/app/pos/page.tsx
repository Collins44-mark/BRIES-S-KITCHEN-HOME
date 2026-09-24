'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import {
  SaleCompletedModal,
  type CompletedSaleContext,
} from '@/components/receipt/sale-completed-modal';
import { listCategories } from '@/lib/supabase/categories';
import { fetchCustomerByPhone, fetchCustomers } from '@/lib/supabase/customers';
import { listProducts, type ProductListItem } from '@/lib/supabase/products';
import {
  availableSellingQuantity,
  listActiveUnitsByProductIds,
  resolveUnitPricePreview,
  type ProductUnitListItem,
} from '@/lib/supabase/product-units';
import {
  createSale,
  type SaleDiscountType,
  type SalePaymentMethod,
} from '@/lib/supabase/sales';
import { formatTzs } from '@/lib/utils';

interface CartLine {
  product: ProductListItem;
  productUnit: ProductUnitListItem;
  quantity: number;
}

function cartKey(productId: string, unitId: string): string {
  return `${productId}::${unitId}`;
}

function pickDefaultUnit(units: ProductUnitListItem[]): ProductUnitListItem | null {
  return (
    units.find((u) => u.isDefault && u.isActive) ??
    units.find((u) => u.unitCode === 'PCS') ??
    units[0] ??
    null
  );
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
  const [completedSale, setCompletedSale] = useState<CompletedSaleContext | null>(null);
  /** Per-product selected selling unit on tiles (before Add). */
  const [tileUnitId, setTileUnitId] = useState<Record<string, string>>({});

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

  const productIds = useMemo(() => products.map((p) => p.id), [products]);

  const {
    data: unitsByProduct = {},
    isLoading: unitsLoading,
    isError: unitsError,
    refetch: refetchUnits,
  } = useQuery({
    queryKey: ['product-units', 'pos', productIds],
    queryFn: () => listActiveUnitsByProductIds(productIds),
    enabled: productIds.length > 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => listCategories({ includeInactive: false }),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'pos'],
    queryFn: () => fetchCustomers({ includeInactive: false, includeWalkIn: false }),
  });

  // Seed tile unit selection to each product's default when units load.
  useEffect(() => {
    setTileUnitId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const product of products) {
        const units = unitsByProduct[product.id] ?? [];
        if (!units.length) continue;
        const current = next[product.id];
        if (!current || !units.some((u) => u.id === current)) {
          const def = pickDefaultUnit(units);
          if (def) {
            next[product.id] = def.id;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [products, unitsByProduct]);

  // UI preview only — create_sale remains authoritative for money totals.
  const subtotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const unitPrice = Number(resolveUnitPricePreview(line.productUnit, line.quantity));
        return sum + unitPrice * line.quantity;
      }, 0),
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
    onError: (err: Error) => toast.error(err.message || 'Failed to complete sale'),
  });

  function resetPosCart() {
    setCart([]);
    setDiscountType('NONE');
    setDiscountValue(0);
    setAmountTendered('');
    setCustomerId('');
    setPhoneSearch('');
    setPaymentMethod('CASH');
  }

  function startNewSale() {
    setCompletedSale(null);
    resetPosCart();
  }

  function resolveUnitForProduct(
    product: ProductListItem,
    preferredUnitId?: string,
  ): ProductUnitListItem | null {
    const units = unitsByProduct[product.id] ?? [];
    if (!units.length) return null;
    if (preferredUnitId) {
      const match = units.find((u) => u.id === preferredUnitId);
      if (match) return match;
    }
    return pickDefaultUnit(units);
  }

  function addToCart(product: ProductListItem, unitOverride?: ProductUnitListItem) {
    const unit =
      unitOverride ??
      resolveUnitForProduct(product, tileUnitId[product.id]);
    if (!unit) {
      toast.error('No active selling unit configured for this product');
      return;
    }

    const available = availableSellingQuantity(product.stockQuantity, unit.conversionToBase);
    if (available < 1) {
      toast.error('Out of stock for this selling unit');
      return;
    }

    setCart((prev) => {
      const key = cartKey(product.id, unit.id);
      const existing = prev.find(
        (l) => cartKey(l.product.id, l.productUnit.id) === key,
      );
      if (existing) {
        if (existing.quantity >= available) {
          toast.error(`Not enough stock (${available} ${unit.unitCode} available)`);
          return prev;
        }
        return prev.map((l) =>
          cartKey(l.product.id, l.productUnit.id) === key
            ? { ...l, quantity: l.quantity + 1, product, productUnit: unit }
            : l,
        );
      }
      return [...prev, { product, productUnit: unit, quantity: 1 }];
    });
  }

  function setLineQuantity(line: CartLine, nextQty: number) {
    const available = availableSellingQuantity(
      line.product.stockQuantity,
      line.productUnit.conversionToBase,
    );
    if (nextQty < 1) {
      setCart((prev) =>
        prev.filter(
          (l) =>
            cartKey(l.product.id, l.productUnit.id) !==
            cartKey(line.product.id, line.productUnit.id),
        ),
      );
      return;
    }
    if (nextQty > available) {
      toast.error(`Not enough stock (${available} ${line.productUnit.unitCode} available)`);
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        cartKey(l.product.id, l.productUnit.id) ===
        cartKey(line.product.id, line.productUnit.id)
          ? { ...l, quantity: nextQty }
          : l,
      ),
    );
  }

  function changeLineUnit(line: CartLine, nextUnitId: string) {
    const units = unitsByProduct[line.product.id] ?? [];
    const nextUnit = units.find((u) => u.id === nextUnitId);
    if (!nextUnit) return;

    const targetKey = cartKey(line.product.id, nextUnit.id);
    const sourceKey = cartKey(line.product.id, line.productUnit.id);
    if (targetKey === sourceKey) return;

    const available = availableSellingQuantity(
      line.product.stockQuantity,
      nextUnit.conversionToBase,
    );
    if (available < 1) {
      toast.error('Out of stock for this selling unit');
      return;
    }

    setCart((prev) => {
      const withoutSource = prev.filter(
        (l) => cartKey(l.product.id, l.productUnit.id) !== sourceKey,
      );
      const existingTarget = withoutSource.find(
        (l) => cartKey(l.product.id, l.productUnit.id) === targetKey,
      );
      const qty = Math.min(line.quantity, available);
      if (existingTarget) {
        const merged = Math.min(existingTarget.quantity + qty, available);
        return withoutSource.map((l) =>
          cartKey(l.product.id, l.productUnit.id) === targetKey
            ? { ...l, quantity: merged, productUnit: nextUnit }
            : l,
        );
      }
      return [
        ...withoutSource,
        { product: line.product, productUnit: nextUnit, quantity: Math.max(1, qty) },
      ];
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
    if (createSaleMutation.isPending) return;

    for (const line of cart) {
      if (!line.productUnit?.id) {
        toast.error('Each cart item needs a selling unit');
        return;
      }
    }

    // Walk-in (empty customerId → null) is valid for fully paid sales.
    const tendered = amountTendered === '' ? total : Number(amountTendered);
    if (Number.isNaN(tendered) || tendered < 0) {
      toast.error('Enter a valid amount received');
      return;
    }
    if (tendered < total && !customerId.trim()) {
      toast.error('Credit sales require a registered customer. Walk-in is fine for paid sales.');
      return;
    }

    // Record payment = sale total when tendered covers it (change is cashier-side only).
    const paidAmount =
      Math.round((tendered >= total ? total : tendered) * 100) / 100;
    const changeDue =
      tendered > total ? Math.round((tendered - total) * 100) / 100 : 0;
    const cashReceivedForReceipt =
      paymentMethod === 'CASH' && tendered > 0
        ? String(Math.round(tendered * 100) / 100)
        : null;

    // Money payments only — unpaid remainder becomes amount_due in the RPC.
    const payments =
      paidAmount > 0 ? [{ method: paymentMethod, amount: paidAmount }] : [];

    createSaleMutation.mutate(
      {
        customerId: customerId.trim() ? customerId : null,
        items: cart.map((l) => ({
          productId: l.product.id,
          productUnitId: l.productUnit.id,
          quantity: l.quantity,
        })),
        discountType,
        discountValue,
        payments,
      },
      {
        onSuccess: (sale) => {
          setCompletedSale({
            saleId: sale.id,
            cashReceived: cashReceivedForReceipt,
            changeDue: changeDue > 0 ? String(changeDue) : null,
          });
          resetPosCart();
          toast.success(
            sale.invoice_number
              ? `Sale completed — ${sale.invoice_number}`
              : 'Sale completed',
          );
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['product-units'] });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          queryClient.invalidateQueries({ queryKey: ['debts'] });
          queryClient.invalidateQueries({ queryKey: ['reports'] });
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
      },
    );
  }

  return (
    <div className="space-y-4 pb-24 xl:pb-0">
      <div>
        <h1 className="page-title">POS / Sales</h1>
        <p className="page-subtitle">Search products, build a cart, and complete the sale.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Products column */}
        <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-7">
          <div className="glass-card p-3 sm:p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <div className="relative min-w-0 flex-1">
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
                className="h-11 w-full shrink-0 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm sm:w-auto sm:min-w-[10rem]"
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

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
            {(isLoading || (productIds.length > 0 && unitsLoading)) &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card h-36 animate-pulse bg-white/40" />
              ))}
            {(isError || unitsError) && !isLoading && !unitsLoading && (
              <div className="glass-card col-span-2 p-6 text-center lg:col-span-3">
                <p className="text-sm text-slate-600">Unable to load products. Please try again.</p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch();
                    void refetchUnits();
                  }}
                  className="mt-3 min-h-11 rounded-xl bg-brand-navy px-4 py-2 text-sm text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoading &&
              !unitsLoading &&
              !isError &&
              !unitsError &&
              products.length === 0 && (
                <p className="col-span-2 py-8 text-center text-sm text-slate-400 lg:col-span-3">
                  No products yet
                </p>
              )}
            {!isLoading &&
              !unitsLoading &&
              !isError &&
              !unitsError &&
              products.map((product) => {
                const units = unitsByProduct[product.id] ?? [];
                const selectedUnit =
                  resolveUnitForProduct(product, tileUnitId[product.id]) ??
                  pickDefaultUnit(units);
                const previewPrice = selectedUnit
                  ? resolveUnitPricePreview(selectedUnit, 1)
                  : product.sellingPrice;
                const available = selectedUnit
                  ? availableSellingQuantity(product.stockQuantity, selectedUnit.conversionToBase)
                  : 0;

                return (
                  <div
                    key={product.id}
                    className="glass-card flex min-w-0 flex-col p-2.5 text-left sm:p-3.5"
                  >
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800 sm:text-sm">
                      {product.name}
                    </p>
                    <p className="mt-1.5 text-[15px] font-semibold leading-tight text-slate-900 sm:mt-2 sm:text-lg">
                      <span className="break-words">{formatTzs(previewPrice)}</span>
                      {selectedUnit ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-500 sm:text-xs">
                          / {selectedUnit.unitCode}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-slate-500 sm:text-xs">
                      Stock: {product.stockQuantity} base
                      {selectedUnit
                        ? ` · ${available} ${selectedUnit.unitCode}`
                        : ''}
                    </p>
                    {units.length > 0 ? (
                      <select
                        value={selectedUnit?.id ?? ''}
                        onChange={(e) =>
                          setTileUnitId((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        className="mt-2 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white/80 px-1.5 text-[11px] sm:h-9 sm:px-2 sm:text-xs"
                        aria-label={`Selling unit for ${product.name}`}
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unitCode}
                            {u.unitLabel !== u.unitCode ? ` — ${u.unitLabel}` : ''}
                            {u.conversionToBase > 1 ? ` (=${u.conversionToBase} base)` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-2 text-[11px] text-rose-600">No selling units</p>
                    )}
                    <button
                      type="button"
                      onClick={() => addToCart(product, selectedUnit ?? undefined)}
                      disabled={!selectedUnit || available < 1}
                      className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-navy px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:mt-3 sm:min-h-0 sm:py-1.5 sm:font-medium"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Cart / checkout column */}
        <div className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-5">
          <div className="glass-card p-3.5 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-800 sm:mb-4">Current Cart</h2>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400 sm:py-8">No items yet.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => {
                  const key = cartKey(line.product.id, line.productUnit.id);
                  const unitPrice = resolveUnitPricePreview(line.productUnit, line.quantity);
                  const lineUnits = unitsByProduct[line.product.id] ?? [line.productUnit];
                  const baseQty = line.quantity * line.productUnit.conversionToBase;
                  return (
                    <div
                      key={key}
                      className="space-y-2 border-b border-slate-50 pb-3 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {line.product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatTzs(unitPrice)} / {line.productUnit.unitCode}
                            {line.productUnit.conversionToBase > 1
                              ? ` · ${baseQty} base`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                          onClick={() =>
                            setCart((prev) =>
                              prev.filter(
                                (l) =>
                                  cartKey(l.product.id, l.productUnit.id) !== key,
                              ),
                            )
                          }
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <select
                          value={line.productUnit.id}
                          onChange={(e) => changeLineUnit(line, e.target.value)}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/80 px-2 text-xs sm:h-8 sm:max-w-[7rem] sm:flex-none"
                        >
                          {lineUnits.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitCode}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 sm:h-8 sm:w-8"
                            onClick={() => setLineQuantity(line, line.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-medium">{line.quantity}</span>
                          <button
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 sm:h-8 sm:w-8"
                            onClick={() => setLineQuantity(line, line.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="ml-auto shrink-0 text-xs font-semibold text-slate-700">
                          {formatTzs(Number(unitPrice) * line.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card space-y-3 p-3.5 sm:p-5">
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
            <div className="flex min-w-0 gap-2">
              <input
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="Search by phone 0712345678"
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
              />
              <button
                type="button"
                onClick={findCustomerByPhone}
                className="h-11 shrink-0 rounded-xl bg-slate-100 px-3 text-sm font-medium"
              >
                Find
              </button>
            </div>
          </div>

          <div id="pos-checkout" className="glass-card space-y-3 p-3.5 sm:p-5">
            <h2 className="text-base font-semibold text-slate-800">Discount & Payment</h2>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as SaleDiscountType)}
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white/80 px-2 text-sm sm:px-3"
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
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm"
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
              <div className="flex justify-between gap-2 text-slate-500">
                <span>Subtotal</span>
                <span className="shrink-0">{formatTzs(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-2 text-slate-500">
                <span>Discount</span>
                <span className="shrink-0">-{formatTzs(discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="shrink-0 break-all text-right">{formatTzs(total)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={completeSale}
              disabled={createSaleMutation.isPending || cart.length === 0 || Boolean(completedSale)}
              className="h-12 w-full rounded-2xl bg-brand-navy text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/60 bg-white/90 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-500">
              {cart.length === 0
                ? 'Cart empty'
                : `${cart.length} ${cart.length === 1 ? 'item' : 'items'}`}
            </p>
            <p className="truncate text-base font-semibold text-slate-900">{formatTzs(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              document.getElementById('pos-checkout')?.scrollIntoView({ behavior: 'smooth' });
            }}
            disabled={cart.length === 0}
            className="h-11 shrink-0 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Checkout
          </button>
        </div>
      </div>

      {completedSale && (
        <SaleCompletedModal completed={completedSale} onNewSale={startNewSale} />
      )}
    </div>
  );
}
