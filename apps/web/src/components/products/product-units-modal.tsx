'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { useAuth } from '@/contexts/auth-context';
import {
  PRODUCT_UNIT_CODES,
  createProductPriceTier,
  createProductUnit,
  getProductUnitsCatalog,
  setDefaultProductUnit,
  setProductPriceTierActive,
  setProductUnitActive,
  updateProductPriceTier,
  updateProductUnit,
  type ProductUnitCode,
  type ProductUnitListItem,
  type ProductPriceTierListItem,
} from '@/lib/supabase/product-units';
import { formatTzs } from '@/lib/utils';

type ProductUnitsModalProps = {
  productId: string;
  productName: string;
  onClose: () => void;
};

type UnitFormState = {
  unitCode: ProductUnitCode;
  unitLabel: string;
  conversionToBase: string;
  sellingPrice: string;
  isDefault: boolean;
};

type TierFormState = {
  minQuantity: string;
  unitPrice: string;
};

const emptyUnitForm = (defaults?: Partial<UnitFormState>): UnitFormState => ({
  unitCode: 'SET',
  unitLabel: '',
  conversionToBase: '1',
  sellingPrice: '',
  isDefault: false,
  ...defaults,
});

const emptyTierForm = (): TierFormState => ({
  minQuantity: '',
  unitPrice: '',
});

export function ProductUnitsModal({ productId, productName, onClose }: ProductUnitsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [showInactive, setShowInactive] = useState(true);
  const [editingUnit, setEditingUnit] = useState<ProductUnitListItem | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [unitForm, setUnitForm] = useState<UnitFormState>(emptyUnitForm());
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<ProductPriceTierListItem | null>(null);
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm());
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: catalog,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['product-units-catalog', productId, showInactive],
    queryFn: () => getProductUnitsCatalog(productId, { includeInactive: showInactive }),
    enabled: Boolean(productId),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usedCodes = useMemo(
    () => new Set((catalog?.units ?? []).filter((u) => u.isActive).map((u) => u.unitCode)),
    [catalog?.units],
  );

  const availableCodes = useMemo(
    () =>
      PRODUCT_UNIT_CODES.filter(
        (code) =>
          !usedCodes.has(code) ||
          (editingUnit != null && editingUnit.unitCode === code),
      ),
    [usedCodes, editingUnit],
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['product-units-catalog', productId] });
  }

  const saveUnitMutation = useMutation({
    mutationFn: async () => {
      const conversion = Number(unitForm.conversionToBase);
      const sellingPrice = Number(unitForm.sellingPrice);
      if (editingUnit) {
        return updateProductUnit(editingUnit.id, {
          unitLabel: unitForm.unitLabel || editingUnit.unitCode,
          conversionToBase: conversion,
          sellingPrice,
        });
      }
      return createProductUnit({
        productId,
        unitCode: unitForm.unitCode,
        unitLabel: unitForm.unitLabel || unitForm.unitCode,
        conversionToBase: conversion,
        sellingPrice,
        isDefault: unitForm.isDefault,
      });
    },
    onSuccess: async (unit) => {
      if (editingUnit && unitForm.isDefault && !editingUnit.isDefault) {
        await setDefaultProductUnit(unit.id);
      }
      toast.success(editingUnit ? 'Selling unit updated' : 'Selling unit added');
      setAddingUnit(false);
      setEditingUnit(null);
      setUnitForm(emptyUnitForm());
      setFormError(null);
      invalidate();
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to save selling unit');
      toast.error(err.message || 'Failed to save selling unit');
    },
  });

  const defaultMutation = useMutation({
    mutationFn: (unitId: string) => setDefaultProductUnit(unitId),
    onSuccess: () => {
      toast.success('Default selling unit updated');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to set default unit'),
  });

  const activeMutation = useMutation({
    mutationFn: ({ unitId, isActive }: { unitId: string; isActive: boolean }) =>
      setProductUnitActive(unitId, isActive),
    onSuccess: (_data, vars) => {
      toast.success(vars.isActive ? 'Selling unit activated' : 'Selling unit deactivated');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update unit status'),
  });

  const saveTierMutation = useMutation({
    mutationFn: async (unitId: string) => {
      const minQuantity = Number(tierForm.minQuantity);
      const unitPrice = Number(tierForm.unitPrice);
      if (editingTier) {
        return updateProductPriceTier(editingTier.id, { minQuantity, unitPrice });
      }
      return createProductPriceTier({ productUnitId: unitId, minQuantity, unitPrice });
    },
    onSuccess: () => {
      toast.success(editingTier ? 'Wholesale tier updated' : 'Wholesale tier added');
      setEditingTier(null);
      setTierForm(emptyTierForm());
      setFormError(null);
      invalidate();
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Failed to save wholesale tier');
      toast.error(err.message || 'Failed to save wholesale tier');
    },
  });

  const tierActiveMutation = useMutation({
    mutationFn: ({ tierId, isActive }: { tierId: string; isActive: boolean }) =>
      setProductPriceTierActive(tierId, isActive),
    onSuccess: (_data, vars) => {
      toast.success(vars.isActive ? 'Tier activated' : 'Tier deactivated');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update tier'),
  });

  function startAddUnit() {
    setEditingUnit(null);
    setAddingUnit(true);
    setFormError(null);
    const nextCode = availableCodes.find((c) => c !== 'PCS') ?? availableCodes[0] ?? 'SET';
    setUnitForm(
      emptyUnitForm({
        unitCode: nextCode,
        unitLabel: nextCode,
        conversionToBase: nextCode === 'PCS' ? '1' : '1',
        sellingPrice: catalog?.legacySellingPrice ?? '',
      }),
    );
  }

  function startEditUnit(unit: ProductUnitListItem) {
    setAddingUnit(false);
    setEditingUnit(unit);
    setFormError(null);
    setUnitForm({
      unitCode: unit.unitCode,
      unitLabel: unit.unitLabel,
      conversionToBase: String(unit.conversionToBase),
      sellingPrice: unit.sellingPrice,
      isDefault: unit.isDefault,
    });
  }

  function cancelUnitForm() {
    setAddingUnit(false);
    setEditingUnit(null);
    setUnitForm(emptyUnitForm());
    setFormError(null);
  }

  function onSubmitUnit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    saveUnitMutation.mutate();
  }

  function onSubmitTier(e: FormEvent, unitId: string) {
    e.preventDefault();
    setFormError(null);
    saveTierMutation.mutate(unitId);
  }

  const busy =
    saveUnitMutation.isPending ||
    defaultMutation.isPending ||
    activeMutation.isPending ||
    saveTierMutation.isPending ||
    tierActiveMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-units-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="glass-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Selling units
            </p>
            <h2 id="product-units-title" className="mt-0.5 text-xl font-semibold text-slate-900">
              {productName}
            </h2>
            {catalog && (
              <p className="mt-1 text-xs text-slate-500">
                Stock {catalog.stockQuantityBase} {catalog.baseUnitLabel} (base) · Cost{' '}
                {formatTzs(catalog.costPricePerBase)} / base
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs leading-relaxed text-slate-600">
            Inventory stays in base units (normally PCS). Selling units only configure conversion
            and price — they do not create separate stock pools. For wholesale pricing, the highest
            minimum quantity that is less than or equal to the entered quantity is used.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show inactive
            </label>
            {canManage && !addingUnit && !editingUnit && (
              <button
                type="button"
                onClick={startAddUnit}
                disabled={availableCodes.length === 0 || isLoading}
                className="rounded-xl bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Add unit
              </button>
            )}
          </div>

          {!canManage && (
            <p className="mt-2 text-xs text-amber-700">
              View only — ADMIN or MANAGER can change selling units.
            </p>
          )}

          {isLoading && (
            <div className="mt-4 space-y-2">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {isError && !isLoading && (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/80 p-4 text-center">
              <p className="text-sm text-rose-700">
                {error instanceof Error ? error.message : 'Unable to load selling units.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-3 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          {!isLoading && !isError && catalog && catalog.units.length === 0 && (
            <p className="mt-4 text-center text-sm text-slate-500">No selling units yet.</p>
          )}

          {(addingUnit || editingUnit) && canManage && (
            <form
              onSubmit={onSubmitUnit}
              className="mt-4 space-y-3 rounded-xl border border-slate-200/80 bg-white/60 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {editingUnit ? `Edit ${editingUnit.unitCode}` : 'New selling unit'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-slate-500">
                  Unit
                  <select
                    value={unitForm.unitCode}
                    disabled={Boolean(editingUnit)}
                    onChange={(e) => {
                      const code = e.target.value as ProductUnitCode;
                      setUnitForm((f) => ({
                        ...f,
                        unitCode: code,
                        unitLabel: f.unitLabel || code,
                        conversionToBase: code === 'PCS' ? '1' : f.conversionToBase,
                      }));
                    }}
                    className="input mt-1"
                  >
                    {(editingUnit ? PRODUCT_UNIT_CODES : availableCodes).map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-500">
                  Label
                  <input
                    value={unitForm.unitLabel}
                    onChange={(e) => setUnitForm((f) => ({ ...f, unitLabel: e.target.value }))}
                    className="input mt-1"
                    placeholder="e.g. Set of 6"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Conversion to base
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    disabled={unitForm.unitCode === 'PCS'}
                    value={unitForm.unitCode === 'PCS' ? '1' : unitForm.conversionToBase}
                    onChange={(e) =>
                      setUnitForm((f) => ({ ...f, conversionToBase: e.target.value }))
                    }
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Selling price
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={unitForm.sellingPrice}
                    onChange={(e) => setUnitForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                    className="input mt-1"
                  />
                </label>
              </div>
              {!editingUnit && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={unitForm.isDefault}
                    onChange={(e) => setUnitForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  Set as default selling unit
                </label>
              )}
              {editingUnit && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={unitForm.isDefault}
                    onChange={(e) => setUnitForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  Make this the default selling unit
                </label>
              )}
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saveUnitMutation.isPending}
                  className="rounded-xl bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saveUnitMutation.isPending ? 'Saving…' : 'Save unit'}
                </button>
                <button
                  type="button"
                  onClick={cancelUnitForm}
                  disabled={saveUnitMutation.isPending}
                  className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!isLoading &&
            !isError &&
            catalog &&
            catalog.units.map((unit) => {
              const expanded = expandedUnitId === unit.id;
              return (
                <div
                  key={unit.id}
                  className={`mt-3 rounded-xl border p-3 ${
                    unit.isActive
                      ? 'border-slate-200/80 bg-white/55'
                      : 'border-slate-100 bg-slate-50/60 opacity-80'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {unit.unitCode}
                          {unit.unitLabel !== unit.unitCode ? (
                            <span className="font-normal text-slate-500"> · {unit.unitLabel}</span>
                          ) : null}
                        </span>
                        {unit.isDefault && unit.isActive && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Default
                          </span>
                        )}
                        {!unit.isActive && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        1 {unit.unitCode} = {unit.conversionToBase} base ·{' '}
                        {formatTzs(unit.sellingPrice)}
                      </p>
                    </div>
                    <div className="flex shrink-0 justify-end">
                      <RowActionsMenu
                        actions={[
                          {
                            label: expanded ? 'Hide wholesale' : 'Wholesale',
                            onClick: () => {
                              setExpandedUnitId(expanded ? null : unit.id);
                              if (!expanded) {
                                setEditingTier(null);
                                setTierForm(emptyTierForm());
                              }
                            },
                          },
                          canManage
                            ? {
                                label: 'Edit',
                                onClick: () => startEditUnit(unit),
                              }
                            : null,
                          canManage && unit.isActive && !unit.isDefault
                            ? {
                                label: 'Set default',
                                disabled: defaultMutation.isPending,
                                onClick: () => defaultMutation.mutate(unit.id),
                              }
                            : null,
                          canManage
                            ? unit.isActive
                              ? {
                                  label: 'Deactivate',
                                  disabled: activeMutation.isPending || unit.isDefault,
                                  tone: 'danger' as const,
                                  onClick: () =>
                                    activeMutation.mutate({ unitId: unit.id, isActive: false }),
                                }
                              : {
                                  label: 'Activate',
                                  disabled: activeMutation.isPending,
                                  onClick: () =>
                                    activeMutation.mutate({ unitId: unit.id, isActive: true }),
                                }
                            : null,
                        ]}
                      />
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Wholesale pricing
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        For wholesale pricing, the highest minimum quantity that is less than or
                        equal to the entered quantity is used.
                      </p>

                      {unit.priceTiers.length === 0 && (
                        <p className="mt-2 text-xs text-slate-400">No wholesale tiers.</p>
                      )}

                      <ul className="mt-2 space-y-1.5">
                        {unit.priceTiers.map((tier) => (
                          <li
                            key={tier.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs"
                          >
                            <span className={!tier.isActive ? 'text-slate-400 line-through' : ''}>
                              {tier.minQuantity}+ → {formatTzs(tier.unitPrice)}
                              {!tier.isActive ? ' (inactive)' : ''}
                            </span>
                            {canManage && (
                              <RowActionsMenu
                                actions={[
                                  {
                                    label: 'Edit',
                                    onClick: () => {
                                      setEditingTier(tier);
                                      setTierForm({
                                        minQuantity: String(tier.minQuantity),
                                        unitPrice: tier.unitPrice,
                                      });
                                      setExpandedUnitId(unit.id);
                                    },
                                  },
                                  {
                                    label: tier.isActive ? 'Deactivate' : 'Activate',
                                    disabled: tierActiveMutation.isPending,
                                    tone: tier.isActive ? 'danger' : 'default',
                                    onClick: () =>
                                      tierActiveMutation.mutate({
                                        tierId: tier.id,
                                        isActive: !tier.isActive,
                                      }),
                                  },
                                ]}
                              />
                            )}
                          </li>
                        ))}
                      </ul>

                      {canManage && (
                        <form
                          onSubmit={(e) => onSubmitTier(e, unit.id)}
                          className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
                        >
                          <input
                            type="number"
                            min={1}
                            step={1}
                            required
                            placeholder="Min qty"
                            value={tierForm.minQuantity}
                            onChange={(e) =>
                              setTierForm((f) => ({ ...f, minQuantity: e.target.value }))
                            }
                            className="input"
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            placeholder="Unit price"
                            value={tierForm.unitPrice}
                            onChange={(e) =>
                              setTierForm((f) => ({ ...f, unitPrice: e.target.value }))
                            }
                            className="input"
                          />
                          <button
                            type="submit"
                            disabled={saveTierMutation.isPending}
                            className="rounded-xl bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {saveTierMutation.isPending
                              ? '…'
                              : editingTier
                                ? 'Update'
                                : 'Add'}
                          </button>
                          {editingTier && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTier(null);
                                setTierForm(emptyTierForm());
                              }}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600"
                            >
                              Cancel
                            </button>
                          )}
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <style jsx global>{`
        .input {
          height: 2.5rem;
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
        .input:disabled {
          opacity: 0.7;
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
