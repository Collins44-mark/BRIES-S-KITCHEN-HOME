'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { AuthUser, UserRole } from '@bries/types';
import { createClient } from '@/lib/supabase/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const VALID_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER'];

function mapSupabaseUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  const localPart = email.includes('@') ? email.split('@')[0]! : email || 'user';
  const roleCandidate = String(meta.role ?? '').toUpperCase() as UserRole;

  return {
    id: user.id,
    email,
    username: String(meta.username ?? localPart),
    firstName: String(meta.first_name ?? meta.firstName ?? localPart),
    lastName: String(meta.last_name ?? meta.lastName ?? ''),
    role: VALID_ROLES.includes(roleCandidate) ? roleCandidate : 'ADMIN',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      setUser(mapSupabaseUser(data.user));
    }
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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
