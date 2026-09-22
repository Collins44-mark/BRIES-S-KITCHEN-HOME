'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthUser } from '@bries/types';
import { createClient } from '@/lib/supabase/client';
import {
  fetchCurrentProfile,
  toAuthUser,
  type ProfileLoadResult,
} from '@/lib/supabase/profile';

type ProfileStatus =
  | 'loading'
  | 'unauthenticated'
  | 'ok'
  | 'profile_missing'
  | 'inactive'
  | 'error';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Clear state when Auth exists but public.profiles row is missing. */
  profileMissing: boolean;
  profileStatus: ProfileStatus;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyProfileResult(
  result: ProfileLoadResult,
): Pick<AuthContextValue, 'user' | 'profileMissing' | 'profileStatus'> {
  switch (result.status) {
    case 'unauthenticated':
      return {
        user: null,
        profileMissing: false,
        profileStatus: 'unauthenticated',
      };
    case 'profile_missing':
      return {
        user: null,
        profileMissing: true,
        profileStatus: 'profile_missing',
      };
    case 'inactive':
      return {
        user: null,
        profileMissing: false,
        profileStatus: 'inactive',
      };
    case 'ok':
      return {
        user: toAuthUser(result.profile),
        profileMissing: false,
        profileStatus: 'ok',
      };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');

  const syncFromResult = useCallback((result: ProfileLoadResult) => {
    const next = applyProfileResult(result);
    setUser(next.user);
    setProfileMissing(next.profileMissing);
    setProfileStatus(next.profileStatus);
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = createClient();
    const result = await fetchCurrentProfile(supabase);
    syncFromResult(result);
  }, [syncFromResult]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchCurrentProfile(supabase);
        if (!cancelled) {
          syncFromResult(result);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfileMissing(false);
          setProfileStatus('error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void (async () => {
        try {
          const result = await fetchCurrentProfile(supabase);
          if (!cancelled) {
            syncFromResult(result);
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setUser(null);
            setProfileMissing(false);
            setProfileStatus('error');
            setLoading(false);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [syncFromResult]);

  const login = useCallback(
    async (email: string, password: string) => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const result = await fetchCurrentProfile(supabase);
      syncFromResult(result);

      if (result.status === 'profile_missing') {
        throw new Error('Your account is authenticated but no staff profile was found.');
      }
      if (result.status === 'inactive') {
        throw new Error('Your staff account is inactive. Contact an administrator.');
      }
      if (result.status !== 'ok') {
        throw new Error('Unable to load staff profile.');
      }
    },
    [syncFromResult],
  );

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfileMissing(false);
    setProfileStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      profileMissing,
      profileStatus,
      login,
      logout,
      refreshProfile,
    }),
    [user, loading, profileMissing, profileStatus, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
