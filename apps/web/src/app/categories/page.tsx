'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { TableEmptyRow, TableErrorRow, TableLoadingRow } from '@/components/ui/query-status';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { useLocale } from '@/contexts/locale-context';
import {
  createCategory,
  listCategories,
  setCategoryActive,
  updateCategory,
  type CategoryRow,
} from '@/lib/supabase/categories';
import { statusKey } from '@/lib/i18n/dictionaries';

export default function CategoriesPage() {
  return (
    <AppShell>
      <CategoriesView />
    </AppShell>
  );
}

function CategoriesView() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['categories', showInactive ? 'all' : 'active'],
    queryFn: () => listCategories({ includeInactive: showInactive }),
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success(t('common.saved'));
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string; description?: string | null }) =>
      updateCategory(id, input),
    onSuccess: () => {
      toast.success(t('common.changesSaved'));
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setCategoryActive(id, isActive),
    onSuccess: () => {
      toast.success(t('common.changesSaved'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: Error) => toast.error(err.message || t('common.somethingWrong')),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: String(fd.get('name') || ''),
      description: String(fd.get('description') || '') || null,
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      name: String(fd.get('name') || ''),
      description: String(fd.get('description') || '') || null,
    });
  }

  function statusLabel(isActive: boolean) {
    const key = statusKey(isActive ? 'ACTIVE' : 'INACTIVE');
    return key ? t(key) : isActive ? t('common.active') : t('common.inactive');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{t('categories.title')}</h1>
          <p className="page-subtitle">{t('categories.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t('common.showInactive')}
          </label>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
            className="min-h-11 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
          >
            {showForm ? t('common.close') : t('categories.add')}
          </button>
        </div>
      </div>

      {showForm && !editing && (
        <form onSubmit={onCreate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input name="name" required placeholder={t('common.name')} className="field" />
          <input name="description" placeholder={t('common.description')} className="field" />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white md:col-span-2 disabled:opacity-60"
          >
            {createMutation.isPending ? t('common.loading') : t('common.save')}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={onUpdate} className="glass-card grid gap-3 p-5 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={editing.name}
            placeholder={t('common.name')}
            className="field"
          />
          <input
            name="description"
            defaultValue={editing.description ?? ''}
            placeholder={t('common.description')}
            className="field"
          />
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? t('common.loading') : t('categories.edit')}
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
        {/* Mobile / tablet cards */}
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
          {!isLoading && !isError && categories.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              {t('categories.noCategories')}
            </p>
          )}
          {!isLoading &&
            !isError &&
            categories.map((c) => (
              <div key={c.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                      {c.description ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      c.is_active ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {statusLabel(c.is_active)}
                  </span>
                </div>
                <div className="mt-2.5 flex justify-end">
                  <RowActionsMenu
                    actions={[
                      {
                        label: t('common.edit'),
                        onClick: () => {
                          setShowForm(false);
                          setEditing(c);
                        },
                      },
                      {
                        label: c.is_active ? t('common.deactivate') : t('common.activate'),
                        disabled: toggleMutation.isPending,
                        tone: c.is_active ? 'danger' : 'default',
                        onClick: () =>
                          toggleMutation.mutate({ id: c.id, isActive: !c.is_active }),
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
        </div>

        {/* Desktop table */}
        <div className="table-scroll hidden lg:block">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                <th className="px-4 py-3 font-medium">{t('common.description')}</th>
                <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                <th className="px-4 py-3 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableLoadingRow colSpan={4} />}
              {isError && !isLoading && <TableErrorRow colSpan={4} onRetry={() => refetch()} />}
              {!isLoading && !isError && categories.length === 0 && (
                <TableEmptyRow colSpan={4} message={t('categories.noCategories')} />
              )}
              {!isLoading &&
                !isError &&
                categories.map((c) => (
                  <tr key={c.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={c.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                        {statusLabel(c.is_active)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowActionsMenu
                          actions={[
                            {
                              label: t('common.edit'),
                              onClick: () => {
                                setShowForm(false);
                                setEditing(c);
                              },
                            },
                            {
                              label: c.is_active ? t('common.deactivate') : t('common.activate'),
                              disabled: toggleMutation.isPending,
                              tone: c.is_active ? 'danger' : 'default',
                              onClick: () =>
                                toggleMutation.mutate({ id: c.id, isActive: !c.is_active }),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
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
          outline: none;
        }
        .field:focus {
          border-color: #7dd3fc;
          box-shadow: 0 0 0 2px rgba(186, 230, 253, 0.8);
        }
      `}</style>
    </div>
  );
}
