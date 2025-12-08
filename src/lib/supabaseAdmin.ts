import { createClient } from '@supabase/supabase-js';

import { ENV } from '@/lib/config';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ENV.SUPABASE_URL || !serviceRoleKey) {
  throw new Error('Missing Supabase service role configuration');
}

export const supabaseAdmin = createClient(ENV.SUPABASE_URL, serviceRoleKey);

export const getSupabaseAdminClient = () => supabaseAdmin;
