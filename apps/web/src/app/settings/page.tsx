'use client';

import { AppShell } from '@/components/layout/app-shell';
import { BrandLogo, ProfileAvatar } from '@/components/brand/brand-logo';
import { useAuth } from '@/contexts/auth-context';

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}

function SettingsView() {
  const { user } = useAuth();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Business and account preferences.</p>
      </div>

      <div className="glass-card max-w-2xl space-y-4 p-6">
        <div className="flex items-center gap-4">
          <BrandLogo size={56} rounded="rounded-2xl" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Business</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">BRIE&apos;S HOME &amp; KITCHEN</p>
            <p className="text-sm text-slate-500">Quality for a Better Home</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white/50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Replace brand logo</p>
          <p className="mt-1">
            Put your logo file at{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              apps/web/public/brand/logo.png
            </code>{' '}
            (preferred) or{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              apps/web/public/brand/logo.svg
            </code>
            .
          </p>
          <p className="mt-2">
            Optional profile photo:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              apps/web/public/brand/avatar.png
            </code>
          </p>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <ProfileAvatar name={displayName} size={44} />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
            <p className="mt-1 font-medium text-slate-800">{displayName}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <p className="text-sm text-slate-500">{user?.role}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-sm text-slate-500">
          <p>Currency: TZS</p>
          <p>Roles supported: Admin, Manager, Cashier, Inventory Manager</p>
          <p>Authentication: Supabase Auth (staff profiles)</p>
        </div>
      </div>
    </div>
  );
}
