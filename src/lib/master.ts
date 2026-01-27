import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const requireMasterUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return { ok: false as const, status: 401 as const, user: null };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('master_accounts')
    .select('id')
    .eq('master_email', user.email.toLowerCase())
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500 as const, user };
  }

  if (!data?.id) {
    return { ok: false as const, status: 403 as const, user };
  }

  return { ok: true as const, status: 200 as const, user };
};
