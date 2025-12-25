import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { ENV } from '@/lib/config';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export const createSupabaseMiddlewareClient = (request: NextRequest) => {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
};
