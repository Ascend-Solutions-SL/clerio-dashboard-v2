import { createBrowserClient } from '@supabase/ssr';

import { ENV } from '@/lib/config';

declare global {
  var __supabaseBrowserClient: ReturnType<typeof createBrowserClient> | undefined;
}

export const createSupabaseBrowserClient = () => {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  if (!globalThis.__supabaseBrowserClient) {
    globalThis.__supabaseBrowserClient = createBrowserClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
  }

  return globalThis.__supabaseBrowserClient;
};
