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
import { authApi } from '@/lib/services';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bries_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((profile) => {
        setUser({
          id: profile.id,
          email: profile.email,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: profile.role,
        });
      })
      .catch(() => {
        localStorage.removeItem('bries_access_token');
        localStorage.removeItem('bries_refresh_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const data = await authApi.login(emailOrUsername, password);
    localStorage.setItem('bries_access_token', data.accessToken);
    localStorage.setItem('bries_refresh_token', data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('bries_refresh_token');
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('bries_access_token');
    localStorage.removeItem('bries_refresh_token');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
