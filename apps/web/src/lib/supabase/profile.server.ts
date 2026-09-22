import { createClient } from '@/lib/supabase/server';
import { fetchCurrentProfile } from '@/lib/supabase/profile';

/**
 * Server Components / Route Handlers only.
 * Cookie session + RLS-scoped profiles read (no service_role).
 */
export async function getCurrentProfile() {
  const supabase = await createClient();
  return fetchCurrentProfile(supabase);
}
