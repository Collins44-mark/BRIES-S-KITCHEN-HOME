'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { BrandLogo } from '@/components/brand/brand-logo';
import styles from './login.module.css';

export default function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className={styles.page}>
        <div className={styles.bg} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/login-bg.jpg"
            alt=""
            className={styles.bgImage}
            decoding="async"
          />
          <div className={styles.bgOverlay} />
        </div>
        <div className={styles.orb} aria-hidden />
        <div className={styles.greenGlass} aria-hidden />
        <div className={styles.bootCenter}>
          <div className={styles.bootSpinner} aria-hidden />
          <span className={styles.visuallyHidden}>Loading</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/login-bg.jpg"
          alt=""
          className={styles.bgImage}
          decoding="async"
        />
        <div className={styles.bgOverlay} />
      </div>

      <div className={styles.orb} aria-hidden />
      <div className={styles.greenGlass} aria-hidden />
      <div className={styles.greenGlassSoft} aria-hidden />

      <div className={styles.stage}>
        <div className={styles.card}>
          <div className={styles.brandBlock}>
            <div className={styles.logoGlass}>
              <BrandLogo size={76} className={styles.logo} rounded="rounded-full" />
            </div>
            <h1 className={styles.title}>BRIE&apos;S HOME &amp; KITCHEN</h1>
            <p className={styles.subtitle}>Quality for a Better Home</p>
            <div className={styles.brandRule} aria-hidden />
          </div>

          <form onSubmit={onSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor={emailId} className={styles.visuallyHidden}>
                Email or username
              </label>
              <div className={styles.inputShell}>
                <span className={styles.iconBadge} aria-hidden>
                  <Mail className={styles.icon} strokeWidth={1.75} />
                </span>
                <input
                  id={emailId}
                  type="text"
                  autoComplete="username"
                  inputMode="email"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="Email or username"
                  className={styles.input}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor={passwordId} className={styles.visuallyHidden}>
                Password
              </label>
              <div className={styles.inputShell}>
                <span className={styles.iconBadge} aria-hidden>
                  <Lock className={styles.icon} strokeWidth={1.75} />
                </span>
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={styles.input}
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className={styles.icon} strokeWidth={1.75} />
                  ) : (
                    <Eye className={styles.icon} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" className={styles.submit} disabled={submitting}>
              <span className={styles.submitLabel}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </span>
              <span className={styles.submitArrow} aria-hidden>
                <ArrowRight className={styles.arrowIcon} strokeWidth={2.25} />
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
