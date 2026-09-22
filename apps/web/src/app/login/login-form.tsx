'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { BrandLogo } from '@/components/brand/brand-logo';

export default function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nextPath = params.get('next') || '/dashboard';

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, user, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(emailOrUsername, password);
      router.replace(nextPath);
    } catch {
      setError('Invalid email/username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size={56} className="mb-4 shadow-soft" rounded="rounded-2xl" />
          <h1 className="text-xl font-semibold text-slate-900">BRIE&apos;S HOME &amp; KITCHEN</h1>
          <p className="mt-1 text-sm text-slate-500">Quality for a Better Home</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email or username
            </label>
            <input
              id="email"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-brand-navy text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
