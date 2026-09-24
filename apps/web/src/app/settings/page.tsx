'use client';

import { FormEvent, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Building2,
  ImageIcon,
  Save,
  Settings2,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { BrandLogo, ProfileAvatar } from '@/components/brand/brand-logo';
import { useAuth } from '@/contexts/auth-context';
import { useLocale } from '@/contexts/locale-context';
import { createClient } from '@/lib/supabase/client';
import { updateOwnProfileNames } from '@/lib/supabase/profile';
import { cn } from '@/lib/utils';
import {
  DEFAULT_BUSINESS_NAME,
  DEFAULT_TAGLINE,
  loadSettingsPreferences,
  saveSettingsPreferences,
  type SettingsPreferences,
  type TimeFormatPref,
} from '@/lib/settings/preferences';
import type { AppLocale } from '@/lib/i18n/dictionaries';

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}

function SettingsView() {
  const { user, refreshProfile } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [prefs, setPrefs] = useState<SettingsPreferences>(() => loadSettingsPreferences());
  const [fullName, setFullName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => {
    const stored = loadSettingsPreferences();
    setPrefs(stored);
    if (stored.locale !== locale) {
      setLocale(stored.locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  useEffect(() => {
    if (!user) return;
    setFullName(`${user.firstName} ${user.lastName}`.trim());
  }, [user]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [logoPreview, photoPreview]);

  function patchPrefs(partial: Partial<SettingsPreferences>) {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }

  function onPickLogo(file: File | null) {
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const next: SettingsPreferences = {
        ...prefs,
        businessName: prefs.businessName.trim() || DEFAULT_BUSINESS_NAME,
        tagline: prefs.tagline.trim() || DEFAULT_TAGLINE,
        currency: 'TZS',
        displayCurrency: 'TZS',
        locale: prefs.locale,
      };
      saveSettingsPreferences(next);
      setLocale(next.locale);
      setPrefs(next);

      if (user) {
        const parts = fullName.trim().split(/\s+/).filter(Boolean);
        const firstName = parts[0] ?? user.firstName;
        const lastName = parts.slice(1).join(' ') || user.lastName || firstName;
        if (firstName !== user.firstName || lastName !== user.lastName) {
          const supabase = createClient();
          await updateOwnProfileNames(supabase, { firstName, lastName });
          await refreshProfile();
        }
      }

      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const displayName = fullName.trim() || (user ? `${user.firstName} ${user.lastName}` : 'User');

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div className="min-w-0">
        <h1 className="page-title">{t('settings.title')}</h1>
        <p className="page-subtitle">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        {/* Left column */}
        <section className="glass-card flex flex-col gap-8 p-5 sm:p-6 lg:p-7">
          <div className="space-y-5">
            <SectionHeader
              icon={Building2}
              title={t('settings.business.title')}
              subtitle={t('settings.business.subtitle')}
            />

            <Field label={t('settings.business.name')} htmlFor={`${formId}-biz-name`}>
              <input
                id={`${formId}-biz-name`}
                className="settings-field"
                value={prefs.businessName}
                onChange={(e) => patchPrefs({ businessName: e.target.value })}
              />
            </Field>

            <Field label={t('settings.business.tagline')} htmlFor={`${formId}-tagline`}>
              <input
                id={`${formId}-tagline`}
                className="settings-field"
                value={prefs.tagline}
                onChange={(e) => patchPrefs({ tagline: e.target.value })}
              />
            </Field>

            <Field label={t('settings.business.currency')} htmlFor={`${formId}-currency`}>
              <select id={`${formId}-currency`} className="settings-field" value="TZS" disabled>
                <option value="TZS">{t('settings.preferences.currencyTzs')}</option>
              </select>
            </Field>

            <Field label={t('settings.business.phone')} htmlFor={`${formId}-biz-phone`}>
              <input
                id={`${formId}-biz-phone`}
                className="settings-field"
                value={prefs.businessPhone}
                onChange={(e) => patchPrefs({ businessPhone: e.target.value })}
                placeholder="+255 …"
                inputMode="tel"
              />
            </Field>

            <Field label={t('settings.business.address')} htmlFor={`${formId}-address`}>
              <textarea
                id={`${formId}-address`}
                className="settings-field min-h-[88px] resize-y py-3"
                value={prefs.businessAddress}
                onChange={(e) => patchPrefs({ businessAddress: e.target.value })}
                rows={3}
              />
            </Field>
          </div>

          <div className="space-y-4 border-t border-slate-200/50 pt-6">
            <SectionHeader
              icon={ImageIcon}
              title={t('settings.branding.title')}
              subtitle={t('settings.branding.subtitle')}
            />

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white/60 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BrandLogo size={72} rounded="rounded-full" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={1.9} />
                  {t('settings.branding.changeLogo')}
                </button>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={() => {
                    if (logoPreview) URL.revokeObjectURL(logoPreview);
                    setLogoPreview(null);
                    if (logoInputRef.current) logoInputRef.current.value = '';
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  {t('settings.branding.remove')}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,.png,.svg"
                  className="hidden"
                  onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-slate-500">
              {t('settings.branding.logoHint')}
            </p>
          </div>
        </section>

        {/* Right column */}
        <section className="glass-card flex flex-col gap-8 p-5 sm:p-6 lg:p-7">
          <div className="space-y-5">
            <SectionHeader
              icon={UserRound}
              title={t('settings.profile.title')}
              subtitle={t('settings.profile.subtitle')}
            />

            <Field label={t('settings.profile.fullName')} htmlFor={`${formId}-name`}>
              <input
                id={`${formId}-name`}
                className="settings-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field label={t('settings.profile.email')} htmlFor={`${formId}-email`}>
              <input
                id={`${formId}-email`}
                className="settings-field settings-field-readonly"
                value={user?.email ?? ''}
                readOnly
                tabIndex={0}
              />
            </Field>

            <Field label={t('settings.profile.phone')} htmlFor={`${formId}-phone`}>
              <input
                id={`${formId}-phone`}
                className="settings-field"
                value={prefs.profilePhone}
                onChange={(e) => patchPrefs({ profilePhone: e.target.value })}
                placeholder="+255 …"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>

            <Field label={t('settings.profile.role')} htmlFor={`${formId}-role`}>
              <select
                id={`${formId}-role`}
                className="settings-field settings-field-readonly"
                value="owner"
                disabled
              >
                <option value="owner">{t('settings.profile.roleOwner')}</option>
              </select>
            </Field>

            <div className="space-y-3 pt-1">
              <p className="text-[12.5px] font-medium text-slate-600">
                {t('settings.profile.photo')}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative h-[64px] w-[64px] overflow-hidden rounded-full border border-white/80 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ProfileAvatar name={displayName} size={64} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.9} />
                    {t('settings.profile.changePhoto')}
                  </button>
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => {
                      if (photoPreview) URL.revokeObjectURL(photoPreview);
                      setPhotoPreview(null);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    {t('settings.profile.removePhoto')}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500">
                {t('settings.profile.photoHint')}
              </p>
            </div>
          </div>

          <div className="space-y-5 border-t border-slate-200/50 pt-6">
            <SectionHeader
              icon={Settings2}
              title={t('settings.preferences.title')}
              subtitle={t('settings.preferences.subtitle')}
            />

            <Field
              label={t('settings.preferences.displayCurrency')}
              htmlFor={`${formId}-disp-currency`}
            >
              <select
                id={`${formId}-disp-currency`}
                className="settings-field"
                value="TZS"
                disabled
              >
                <option value="TZS">{t('settings.preferences.currencyTzs')}</option>
              </select>
            </Field>

            <Field label={t('settings.preferences.dateFormat')} htmlFor={`${formId}-date`}>
              <select
                id={`${formId}-date`}
                className="settings-field"
                value="d_mon_y"
                disabled
              >
                <option value="d_mon_y">{t('settings.preferences.dateExample')}</option>
              </select>
            </Field>

            <Field label={t('settings.preferences.timeFormat')} htmlFor={`${formId}-time`}>
              <select
                id={`${formId}-time`}
                className="settings-field"
                value={prefs.timeFormat}
                onChange={(e) =>
                  patchPrefs({ timeFormat: e.target.value as TimeFormatPref })
                }
              >
                <option value="12h">{t('settings.preferences.time12')}</option>
                <option value="24h">{t('settings.preferences.time24')}</option>
              </select>
            </Field>

            <Field label={t('settings.preferences.language')} htmlFor={`${formId}-lang`}>
              <select
                id={`${formId}-lang`}
                className="settings-field"
                value={prefs.locale}
                onChange={(e) => {
                  const next = e.target.value as AppLocale;
                  patchPrefs({ locale: next });
                  setLocale(next);
                }}
              >
                <option value="en">{t('settings.preferences.langEn')}</option>
                <option value="sw">{t('settings.preferences.langSw')}</option>
              </select>
            </Field>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex h-11 min-w-[160px] items-center justify-center gap-2 px-5 text-sm disabled:opacity-70"
              >
                <Save className="h-4 w-4" strokeWidth={1.9} />
                {t('settings.save')}
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .settings-field {
          height: 2.75rem;
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.62);
          padding: 0 0.9rem;
          font-size: 0.9rem;
          color: #0f172a;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }
        .settings-field:focus {
          border-color: rgba(255, 255, 255, 0.95);
          box-shadow:
            0 0 0 3px rgba(148, 163, 184, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .settings-field-readonly {
          color: #64748b;
          background: rgba(248, 250, 252, 0.72);
        }
        .settings-secondary-btn {
          display: inline-flex;
          min-height: 2.5rem;
          align-items: center;
          gap: 0.4rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.55);
          padding: 0.45rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 550;
          color: #334155;
          box-shadow:
            0 4px 12px rgba(15, 23, 42, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: background 0.15s ease;
        }
        .settings-secondary-btn:hover {
          background: rgba(255, 255, 255, 0.78);
        }
      `}</style>
    </form>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]',
          'border border-white/80 bg-white/55 text-slate-700',
          'shadow-[0_4px_12px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]',
          'backdrop-blur-md',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.85} />
      </div>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="text-[12.5px] font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
