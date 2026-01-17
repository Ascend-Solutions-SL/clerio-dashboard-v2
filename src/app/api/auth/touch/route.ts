import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { ENV, assertEnv } from '@/lib/config';
import {
  AUTH_ACTIVITY_COOKIE_NAME,
  decodeAuthActivityCookie,
  encodeAuthActivityCookie,
  getAuthActivityConfig,
} from '@/lib/auth-activity';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const createSupabaseRouteClient = (request: NextRequest, response: NextResponse) => {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
};

const buildCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSeconds,
});

export async function POST(request: NextRequest) {
  assertEnv();

  const response = NextResponse.json({ ok: true });
  const supabase = createSupabaseRouteClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    response.cookies.delete(AUTH_ACTIVITY_COOKIE_NAME);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: response.headers });
  }

  const { idleTimeoutSeconds, maxSessionSeconds } = getAuthActivityConfig();

  const now = Date.now();
  const currentCookie = request.cookies.get(AUTH_ACTIVITY_COOKIE_NAME)?.value;
  const currentPayload = currentCookie ? await decodeAuthActivityCookie(currentCookie) : null;

  const sessionStart = currentPayload?.ss ?? now;
  const payload = { la: now, ss: sessionStart };

  const encoded = await encodeAuthActivityCookie(payload);
  response.cookies.set(AUTH_ACTIVITY_COOKIE_NAME, encoded, buildCookieOptions(maxSessionSeconds));

  return response;
}

export async function DELETE(request: NextRequest) {
  assertEnv();

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_ACTIVITY_COOKIE_NAME);

  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();

  return response;
}
