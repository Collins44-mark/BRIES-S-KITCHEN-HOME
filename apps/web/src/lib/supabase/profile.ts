import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthUser, UserRole } from '@bries/types';

const VALID_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER'];

export type StaffProfile = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
};

export type ProfileLoadResult =
  | { status: 'unauthenticated'; profile: null; authUser: null }
  | { status: 'profile_missing'; profile: null; authUser: User }
  | { status: 'inactive'; profile: StaffProfile; authUser: User }
  | { status: 'ok'; profile: StaffProfile; authUser: User };

type ProfileRow = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

function normalizeRole(role: string): UserRole {
  const candidate = role.toUpperCase() as UserRole;
  return VALID_ROLES.includes(candidate) ? candidate : 'CASHIER';
}

function mapRow(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    role: normalizeRole(row.role),
    is_active: row.is_active,
  };
}

/** Map a DB profile row to the app's existing AuthUser shape (camelCase). */
export function toAuthUser(profile: StaffProfile): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profile.role,
  };
}

/**
 * Load the current Auth user + public.profiles row using the caller's RLS session.
 * Does not use the service_role key.
 */
export async function fetchCurrentProfile(
  supabase: SupabaseClient,
): Promise<ProfileLoadResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: 'unauthenticated', profile: null, authUser: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, first_name, last_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load staff profile');
  }

  if (!data) {
    return { status: 'profile_missing', profile: null, authUser: user };
  }

  const profile = mapRow(data as ProfileRow);

  if (!profile.is_active) {
    return { status: 'inactive', profile, authUser: user };
  }

  return { status: 'ok', profile, authUser: user };
}
