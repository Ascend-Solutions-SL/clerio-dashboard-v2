import { createClient } from '@supabase/supabase-js';

import { ENV } from '@/lib/config';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = typeof window === 'undefined'
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createSupabaseBrowserClient();
